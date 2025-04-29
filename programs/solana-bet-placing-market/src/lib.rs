use anchor_lang::error_code;
use anchor_lang::prelude::*;
use anchor_spl::token;
use anchor_spl::token::{Mint, Token, TokenAccount};

declare_id!("3waVbK9Pps4X1ZwS5GbwDQKmX5syrwe6guwnyN3YJfRc");

#[program]
pub mod solana_bet_placing_market {
    use super::*;
    use anchor_spl::token;

    pub fn initialize_market_factory(ctx: Context<InitializeMarketFactory>) -> Result<()> {
        let market_factory = &mut ctx.accounts.market_factory;

        // Store the number of created markets, initially to 0
        market_factory.created_markets = 0;

        Ok(())
    }

    pub fn create_new_market(ctx: Context<InitializeMarket>, oracle_key: Pubkey) -> Result<()> {
        let market = &mut ctx.accounts.market;
        let market_factory = &mut ctx.accounts.market_factory;

        // Store the USD mint and market-specific mint addresses
        // once they have been initialized by the sys
        market.usd_mint = ctx.accounts.usd_mint.key();
        market.yes_mint = ctx.accounts.yes_mint.key();
        market.no_mint = ctx.accounts.no_mint.key();
        market.lp_share_mint = ctx.accounts.lp_share_mint.key();
        market.vault = ctx.accounts.vault.key();
        market.authority = ctx.accounts.authority.key();
        market.market_number = market_factory.created_markets;
        market.oracle = oracle_key;  // This is the external resolver
        market.bump = ctx.bumps.market;
        market.outcome = None;
        market.resolved = false;

        // Increase the number of created markets
        market_factory.created_markets += 1;

        Ok(())
    }

    pub fn initialize_pool(ctx: Context<InitializePool>) -> Result<()> {
        let pool = &mut ctx.accounts.pool;

        // Store the details for the freshly initialized pool
        pool.yes_liquidity = 0;
        pool.no_liquidity = 0;
        pool.usd_collateral = 0;
        pool.total_yes_mints = 0;
        pool.total_no_mints = 0;
        pool.liquidity_value = 0;
        pool.liquidity_shares = 0;
        pool.bump = ctx.bumps.pool;

        // Store the liquidity pool token accounts
        pool.liquidity_yes_tokens_account = ctx.accounts.liquidity_yes_tokens_account.key();
        pool.liquidity_no_tokens_account = ctx.accounts.liquidity_no_tokens_account.key();

        Ok(())
    }

    pub fn resolve_market(ctx: Context<ResolveMarket>, outcome: u8) -> Result<()> {
        require!(ctx.accounts.market.resolved == false, MarketError::MarketResolved);
        require!(outcome == 0 || outcome == 1, MarketError::InvalidOutcome);


        // Set the outcome and mark the market as resolved
        ctx.accounts.market.outcome = Some(outcome);
        ctx.accounts.market.resolved = true;

        emit!(MarketResolvedEvent{
            market: ctx.accounts.market.key(),
            solver: ctx.accounts.oracle.key(),
            outcome,
        });

        Ok(())
    }

    #[inline(never)]
    pub fn add_liquidity(ctx: Context<PoolLiquidity>, usd_amount: u64) -> Result<()> {
        require!(usd_amount > 0, MarketError::Zero);
        require!(ctx.accounts.market.resolved == false, MarketError::MarketResolved);

        // let pool = &mut ctx.accounts.pool;
        // let market = &ctx.accounts.market;

        // Transfer the usd to the market vault
        {
            let cpi_accounts = token::Transfer {
                from: ctx.accounts.user_usd_account.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            };
            let cpi_program = ctx.accounts.token_program.to_account_info();
            let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
            token::transfer(cpi_ctx, usd_amount)?;
        }

        // 1. Minting the equal number of YES and NO tokens in case
        // the pool has equal chances for both outcomes.
        if ctx.accounts.pool.yes_liquidity == ctx.accounts.pool.no_liquidity {
            add_liquidity_equal_outcomes(ctx.accounts, usd_amount)?;
        } else {
            let total_tokens = ctx.accounts.pool.yes_liquidity + ctx.accounts.pool.no_liquidity;
            let yes_token_price = ctx.accounts.pool.yes_liquidity / total_tokens;
            let no_token_price = ctx.accounts.pool.no_liquidity / total_tokens;

            // Otherwise, we have to decide how to share the liquidity
            if ctx.accounts.pool.no_liquidity > ctx.accounts.pool.yes_liquidity {
                add_unequal_outcomes_with_more_no(
                    ctx.accounts,
                    yes_token_price,
                    no_token_price,
                    usd_amount,
                )?;
            } else {
                add_unequal_outcomes_with_more_yes(
                    ctx.accounts,
                    yes_token_price,
                    no_token_price,
                    usd_amount,
                )?;
            }
        }

        // 2. Updating the pool with the new values
        ctx.accounts.pool.usd_collateral += usd_amount;

        Ok(())
    }

    pub fn remove_liquidity(ctx: Context<PoolLiquidity>, shares: u64) -> Result<()> {
        require!(
            shares < ctx.accounts.user_lp_share_account.amount,
            MarketError::InsufficientFunds
        );
        require!(shares > 0, MarketError::Zero);
        require!(ctx.accounts.market.resolved == false, MarketError::MarketResolved);

        // The first thing we are going to do is to burn the user's shares
        // and remove them from the pool
        {
            // Burn the shares first
            let cpi_context = CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Burn {
                    mint: ctx.accounts.lp_share_mint.to_account_info(),
                    from: ctx.accounts.user_lp_share_account.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(), // the user must sign
                },
            );

            token::burn(cpi_context, shares)?;
        }

        if ctx.accounts.pool.liquidity_value == 0 {
            return Err(MarketError::MarketNotInitialized.into());
        }

        if ctx.accounts.market.resolved == false {
            // Then we are going to calculate what share is the least probable outcome
            let (
                mut lowest_outcome,
                mut highest_outcome,
                liquidity_outcome_token_account,
                user_outcome_token_account,
                lowest_outcome_mint
            ) = if ctx.accounts.pool.yes_liquidity > ctx.accounts.pool.no_liquidity {
                (
                    ctx.accounts.pool.no_liquidity,
                    ctx.accounts.pool.yes_liquidity,
                    &ctx.accounts.liquidity_no_tokens_account,
                    &ctx.accounts.user_no_account,
                    &ctx.accounts.no_mint
                )
            } else {
                (
                    ctx.accounts.pool.yes_liquidity,
                    ctx.accounts.pool.no_liquidity,
                    &ctx.accounts.liquidity_yes_tokens_account,
                    &ctx.accounts.user_yes_account,
                    &ctx.accounts.yes_mint
                )
            };

            // Compute the price aswell
            let lowest_price = highest_outcome / (lowest_outcome + highest_outcome);
            let highest_price = lowest_outcome / (lowest_outcome + highest_outcome);

            let liquidity_shares_value = (ctx.accounts.pool.liquidity_value as u128
                / (lowest_outcome as u128 * shares as u128))
                as u64;

            // We are transferring OUT from the vault, the shares value
            transfer_outcome(
                &ctx.accounts.vault,
                &ctx.accounts.user_usd_account,
                &ctx.accounts.market,
                &ctx.accounts.token_program,
                liquidity_shares_value,
                &[&[
                    b"market",
                    ctx.accounts.market.authority.as_ref(),
                    &ctx.accounts.market.market_number.to_le_bytes(),
                    &ctx.accounts.market.bump.to_le_bytes(),
                ]],
            )?;

            // Burn the yes tokens that are not backed by collateral anymore
            burn_mint_tokens(
                &ctx.accounts.yes_mint,
                &ctx.accounts.liquidity_yes_tokens_account,
                &ctx.accounts.market,
                &ctx.accounts.token_program,
                liquidity_shares_value,
                &[&[
                    b"market",
                    ctx.accounts.market.authority.as_ref(),
                    &ctx.accounts.market.market_number.to_le_bytes(),
                    &ctx.accounts.market.bump.to_le_bytes(),
                ]],
            )?;

            // Burn the no tokens that are not backed by collateral anymore
            burn_mint_tokens(
                &ctx.accounts.no_mint,
                &ctx.accounts.liquidity_no_tokens_account,
                &ctx.accounts.market,
                &ctx.accounts.token_program,
                liquidity_shares_value,
                &[&[
                    b"market",
                    ctx.accounts.market.authority.as_ref(),
                    &ctx.accounts.market.market_number.to_le_bytes(),
                    &ctx.accounts.market.bump.to_le_bytes(),
                ]],
            )?;

            // Then we are removing the shares from our representation of the pool
            ctx.accounts.pool.usd_collateral -= liquidity_shares_value;
            ctx.accounts.pool.liquidity_value -= liquidity_shares_value;
            ctx.accounts.pool.liquidity_shares -= shares;
            ctx.accounts.pool.yes_liquidity -= liquidity_shares_value;
            ctx.accounts.pool.no_liquidity -= liquidity_shares_value;
            ctx.accounts.pool.total_yes_mints -= liquidity_shares_value;
            ctx.accounts.pool.total_no_mints -= liquidity_shares_value;

            lowest_outcome -= liquidity_shares_value;
            highest_outcome -= liquidity_shares_value;

            let remaining_lowest_outcome =
                ((highest_outcome as u128 * highest_price as u128) / lowest_price as u128) as u64;
            let user_belonging_lowest_outcome = lowest_outcome - remaining_lowest_outcome;

            // Now transfer from the liquidity pool to the user's account
            transfer_outcome(
                liquidity_outcome_token_account,
                user_outcome_token_account,
                &ctx.accounts.market,
                &ctx.accounts.token_program,
                user_belonging_lowest_outcome,
                &[&[
                    b"market",
                    ctx.accounts.market.authority.as_ref(),
                    &ctx.accounts.market.market_number.to_le_bytes(),
                    &ctx.accounts.market.bump.to_le_bytes(),
                ]],
            )?;

            // We reduce the pools liquidity
            if ctx.accounts.pool.yes_liquidity < ctx.accounts.pool.no_liquidity {
                ctx.accounts.pool.no_liquidity = remaining_lowest_outcome;
            } else {
                ctx.accounts.pool.yes_liquidity = remaining_lowest_outcome;
            }

            // And we also modify the new liquidity value to be the root value of the multiplication
            let liquidity_value_squared =
                ctx.accounts.pool.yes_liquidity as u128 * ctx.accounts.pool.no_liquidity as u128;
            ctx.accounts.pool.liquidity_value = sqrt_u128(liquidity_value_squared) as u64;

            // Now we are emitting the event
            emit!(LiquidityRemovedEvent{
                market: ctx.accounts.market.key(),
                user: ctx.accounts.user.key(),
                burnt_lp_shares: shares,
                equivalent_usd: liquidity_shares_value,
                received_lowest_outcome_tokens: user_belonging_lowest_outcome,
                received_lowest_outcome_mint: lowest_outcome_mint.key(),
                remaining_yes_tokens: ctx.accounts.pool.yes_liquidity,
                remaining_no_tokens: ctx.accounts.pool.no_liquidity,
            });

            Ok(())
        } else {
            // If the market is resolved, we first calculate to see how much
            // he owns from the remaining winning tokens
            let remaining_lowest_outcome = if ctx.accounts.market.outcome == Some(0) {
                ctx.accounts.pool.no_liquidity
            } else {
                ctx.accounts.pool.yes_liquidity
            };

            let liquidity_share_price = remaining_lowest_outcome / ctx.accounts.pool.liquidity_value;
            let user_belonging_money = shares * liquidity_share_price;

            // We are transferring now out from the vault the shares value
            transfer_outcome(
                &ctx.accounts.vault,
                &ctx.accounts.user_usd_account,
                &ctx.accounts.market,
                &ctx.accounts.token_program,
                user_belonging_money,
                &[&[
                    b"market",
                    ctx.accounts.market.authority.as_ref(),
                    &ctx.accounts.market.market_number.to_le_bytes(),
                    &ctx.accounts.market.bump.to_le_bytes(),
                ]],
            )?;

            // Now we are going to burn the shares
            burn_mint_tokens(
                &ctx.accounts.yes_mint,
                &ctx.accounts.liquidity_yes_tokens_account,
                &ctx.accounts.market,
                &ctx.accounts.token_program,
                user_belonging_money,
                &[&[
                    b"market",
                    ctx.accounts.market.authority.as_ref(),
                    &ctx.accounts.market.market_number.to_le_bytes(),
                    &ctx.accounts.market.bump.to_le_bytes(),
                ]],
            )?;

            burn_mint_tokens(
                &ctx.accounts.no_mint,
                &ctx.accounts.liquidity_no_tokens_account,
                &ctx.accounts.market,
                &ctx.accounts.token_program,
                user_belonging_money,
                &[&[
                    b"market",
                    ctx.accounts.market.authority.as_ref(),
                    &ctx.accounts.market.market_number.to_le_bytes(),
                    &ctx.accounts.market.bump.to_le_bytes(),
                ]],
            )?;

            // Then we are removing the shares from our representation of the pool
            ctx.accounts.pool.usd_collateral -= user_belonging_money;
            ctx.accounts.pool.liquidity_value -= user_belonging_money;
            ctx.accounts.pool.liquidity_shares -= shares;
            ctx.accounts.pool.yes_liquidity -= user_belonging_money;
            ctx.accounts.pool.no_liquidity -= user_belonging_money;
            ctx.accounts.pool.total_yes_mints -= user_belonging_money;
            ctx.accounts.pool.total_no_mints -= user_belonging_money;

            emit!(LiquidityRemovedEvent{
                market: ctx.accounts.market.key(),
                user: ctx.accounts.user.key(),
                burnt_lp_shares: shares,
                equivalent_usd: user_belonging_money,
                received_lowest_outcome_tokens: 0,
                received_lowest_outcome_mint: Pubkey([0; 32]),
                remaining_yes_tokens: ctx.accounts.pool.yes_liquidity,
                remaining_no_tokens: ctx.accounts.pool.no_liquidity,
            });

            Ok(())
        }
    }

    pub fn purchase_outcome_shares(
        ctx: Context<PurchaseOutcomeShares>,
        usd_amount: u64,
        purchased_outcome_mint_pubkey: Pubkey,
    ) -> Result<()> {
        // First and foremost, we need the amount to be bigger than 0
        require!(usd_amount > 0, MarketError::Zero);
        require!(ctx.accounts.market.resolved == false, MarketError::MarketResolved);

        // Transfer the usd to the market vault
        {
            let cpi_accounts = token::Transfer {
                from: ctx.accounts.user_usd_account.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            };
            let cpi_ctx =
                CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);

            token::transfer(cpi_ctx, usd_amount)?;
        }

        let wanted_token_account;
        let other_token_account;
        let wanted_mint;
        let other_mint;
        let wanted_from_liquidity;

        // Now we figure out whether the user wants
        // a YES or a NO token
        if purchased_outcome_mint_pubkey == ctx.accounts.yes_mint.key() {
            // YES token
            wanted_token_account = &ctx.accounts.liquidity_yes_tokens_account;
            other_token_account = &ctx.accounts.liquidity_no_tokens_account;
            wanted_mint = &ctx.accounts.yes_mint;
            other_mint = &ctx.accounts.no_mint;

            // Calculating what is the difference between the initial and the new outcome
            let liquidity_value = ctx.accounts.pool.liquidity_value as u128;
            let no_liquidity = ctx.accounts.pool.no_liquidity as u128;
            let usd = usd_amount as u128;
            let new_yes_liquidity = (liquidity_value.pow(2) / (no_liquidity + usd)) as u64;
            wanted_from_liquidity = ctx.accounts.pool.yes_liquidity - new_yes_liquidity;

            // Then we modify the pool values
            let pool = &mut ctx.accounts.pool;
            pool.yes_liquidity = new_yes_liquidity;
            pool.no_liquidity += usd_amount;
            pool.usd_collateral += usd_amount;
            pool.total_yes_mints += usd_amount;
            pool.total_no_mints += usd_amount;
        } else if purchased_outcome_mint_pubkey == ctx.accounts.no_mint.key() {
            // NO token
            wanted_token_account = &ctx.accounts.liquidity_no_tokens_account;
            other_token_account = &ctx.accounts.liquidity_yes_tokens_account;
            wanted_mint = &ctx.accounts.no_mint;
            other_mint = &ctx.accounts.yes_mint;

            // Calculating what is the difference between the initial and the new outcome
            let liquidity_value = ctx.accounts.pool.liquidity_value as u128;
            let yes_liquidity = ctx.accounts.pool.yes_liquidity as u128;
            let usd = usd_amount as u128;
            let new_no_liquidity = (liquidity_value.pow(2) / (yes_liquidity + usd)) as u64;
            wanted_from_liquidity = ctx.accounts.pool.no_liquidity - new_no_liquidity;

            // Then we modify the pool values
            let pool = &mut ctx.accounts.pool;
            pool.no_liquidity = new_no_liquidity;
            pool.yes_liquidity += usd_amount;
            pool.usd_collateral += usd_amount;
            pool.total_yes_mints += usd_amount;
            pool.total_no_mints += usd_amount;
        } else {
            return Err(MarketError::MintNotAllowed.into());
        }

        // Now we need to first mint the wanted tokens into user's account
        mint_outcome(
            wanted_mint,
            &ctx.accounts.user_outcome_mint_account,
            &ctx.accounts.market,
            &ctx.accounts.token_program,
            usd_amount,
            &[&[
                b"market",
                ctx.accounts.market.authority.as_ref(),
                &ctx.accounts.market.market_number.to_le_bytes(),
                &ctx.accounts.market.bump.to_le_bytes(),
            ]],
        )?;

        // Then we mint the other tokens to the liquidity pool
        mint_outcome(
            other_mint,
            other_token_account,
            &ctx.accounts.market,
            &ctx.accounts.token_program,
            usd_amount,
            &[&[
                b"market",
                ctx.accounts.market.authority.as_ref(),
                &ctx.accounts.market.market_number.to_le_bytes(),
                &ctx.accounts.market.bump.to_le_bytes(),
            ]],
        )?;

        // Then we transfer the purchased tokens from the pool to the user
        transfer_outcome(
            wanted_token_account,
            &ctx.accounts.user_outcome_mint_account,
            &ctx.accounts.market,
            &ctx.accounts.token_program,
            wanted_from_liquidity,
            &[&[
                b"market",
                ctx.accounts.market.authority.as_ref(),
                &ctx.accounts.market.market_number.to_le_bytes(),
                &ctx.accounts.market.bump.to_le_bytes(),
            ]],
        )?;

        // Now we are emitting the event
        emit!(PurchasedOutcomeSharesEvent {
            market: ctx.accounts.market.key(),
            user: ctx.accounts.user.key(),
            amount: usd_amount,
            wanted_shares_purchased: usd_amount + wanted_from_liquidity,
            pool_remaining_yes_tokens: ctx.accounts.pool.yes_liquidity,
            pool_remaining_no_tokens: ctx.accounts.pool.no_liquidity,
        });

        Ok(())
    }
}

#[inline(never)]
pub fn mint_outcome<'info>(
    mint: &Account<'info, Mint>,
    to_account: &Account<'info, TokenAccount>,
    market: &Account<'info, Market>,
    token_program: &Program<'info, Token>,
    amount: u64,
    signer: &[&[&[u8]]],
) -> Result<()> {
    // Creating the context useful for the minting
    let cpi_context = CpiContext::new_with_signer(
        token_program.to_account_info(),
        token::MintTo {
            mint: mint.to_account_info(),
            to: to_account.to_account_info(),
            authority: market.to_account_info(),
        },
        signer,
    );

    // Once created the context, then mint
    token::mint_to(cpi_context, amount)
}

pub fn transfer_outcome<'info>(
    from_mint_account: &Account<'info, TokenAccount>,
    to_mint_account: &Account<'info, TokenAccount>,
    market: &Account<'info, Market>,
    token_program: &Program<'info, Token>,
    amount: u64,
    signer: &[&[&[u8]]],
) -> Result<()> {
    let cpi_context = CpiContext::new_with_signer(
        token_program.to_account_info(),
        token::Transfer {
            from: from_mint_account.to_account_info(),
            to: to_mint_account.to_account_info(),
            authority: market.to_account_info(),
        },
        signer,
    );

    token::transfer(cpi_context, amount)
}

fn burn_mint_tokens<'info>(
    mint: &Account<'info, Mint>,
    from_account: &Account<'info, TokenAccount>,
    market: &Account<'info, Market>,
    token_program: &Program<'info, Token>,
    amount: u64,
    signer: &[&[&[u8]]],
) -> Result<()> {
    let cpi_context = CpiContext::new_with_signer(
        token_program.to_account_info(),
        token::Burn {
            mint: mint.to_account_info(),
            from: from_account.to_account_info(),
            authority: market.to_account_info(),
        },
        signer,
    );

    token::burn(cpi_context, amount)
}

#[inline(never)]
fn add_liquidity_equal_outcomes(add_liquidity: &mut PoolLiquidity, usd_amount: u64) -> Result<()> {
    let market = &add_liquidity.market;
    let pool = &mut add_liquidity.pool;

    // mint first the YES tokens
    mint_outcome(
        &add_liquidity.yes_mint,
        &add_liquidity.liquidity_yes_tokens_account,
        market,
        &add_liquidity.token_program,
        usd_amount,
        &[&[
            b"market",
            market.authority.as_ref(),
            &market.market_number.to_le_bytes(),
            &market.bump.to_le_bytes(),
        ]],
    )?;

    // mint the same number of NO tokens
    mint_outcome(
        &add_liquidity.no_mint,
        &add_liquidity.liquidity_no_tokens_account,
        market,
        &add_liquidity.token_program,
        usd_amount,
        &[&[
            b"market",
            market.authority.as_ref(),
            &market.market_number.to_le_bytes(),
            &market.bump.to_le_bytes(),
        ]],
    )?;

    // Now we also mint the lp shares
    mint_outcome(
        &add_liquidity.lp_share_mint,
        &add_liquidity.user_lp_share_account,
        market,
        &add_liquidity.token_program,
        usd_amount,
        &[&[
            b"market",
            market.authority.as_ref(),
            &market.market_number.to_le_bytes(),
            &market.bump.to_le_bytes(),
        ]],
    )?;

    // Once added, we should also update the pool yes mints with the new values
    pool.yes_liquidity += usd_amount;
    pool.no_liquidity += usd_amount;
    pool.total_yes_mints += usd_amount;
    pool.total_no_mints += usd_amount;

    // And also update the liquidity values & shares
    pool.liquidity_value += usd_amount;
    pool.liquidity_shares += usd_amount;

    emit!(LiquidityAddedEvent {
        market: market.key(),
        user: add_liquidity.user.key(),
        amount: usd_amount,
        liquidity_shares_gained: usd_amount,
        usd_added_to_pool: usd_amount,
        yes_added_to_pool: usd_amount,
        no_added_to_pool: usd_amount,
        yes_given_to_user: 0,
        no_given_to_user: 0,
        yes_minted: usd_amount,
        no_minted: usd_amount,
    });

    Ok(())
}

#[inline(never)]
fn add_unequal_outcomes_with_more_no(
    add_liquidity: &mut PoolLiquidity,
    yes_token_price: u64,
    no_token_price: u64,
    usd_amount: u64,
) -> Result<()> {
    let pool = &mut add_liquidity.pool;
    let market = &add_liquidity.market;

    // Total Minted tokens
    let new_no_minted_tokens = pool.no_liquidity + usd_amount;
    let new_yes_minted_tokens = pool.yes_liquidity + usd_amount;

    // if there is more liquidity in the NO pool, it means it is less likely to win
    // therefore, we are going to give back to the user the more probable outcome

    // Pool minted tokens
    let new_lp_no_minted_tokens = new_no_minted_tokens; // It is the same being the less probable chance
    let new_lp_yes_minted_tokens = (no_token_price * new_no_minted_tokens) / yes_token_price;
    let liquidity_squared = new_lp_no_minted_tokens as u128 * new_lp_yes_minted_tokens as u128;
    let new_liquidity_value = sqrt_u128(liquidity_squared) as u64;

    // Now, we calculate what we have to give to the user
    let user_belonging_yes_tokens = new_yes_minted_tokens - new_lp_yes_minted_tokens;
    let user_belonging_liquidity_shares = new_liquidity_value - pool.liquidity_shares;

    // Now, we first mint the NO tokens in the liquidity pool
    mint_outcome(
        &add_liquidity.no_mint,
        &add_liquidity.liquidity_no_tokens_account,
        market,
        &add_liquidity.token_program,
        usd_amount,
        &[&[
            b"market",
            market.authority.as_ref(),
            &market.market_number.to_le_bytes(),
            &market.bump.to_le_bytes(),
        ]],
    )?;

    // Then mint the YES tokens to the liquidity pool
    let yes_lp_minted = new_lp_yes_minted_tokens - pool.yes_liquidity;
    mint_outcome(
        &add_liquidity.yes_mint,
        &add_liquidity.liquidity_yes_tokens_account,
        market,
        &add_liquidity.token_program,
        yes_lp_minted,
        &[&[
            b"market",
            market.authority.as_ref(),
            &market.market_number.to_le_bytes(),
            &market.bump.to_le_bytes(),
        ]],
    )?;

    // Then mint what belongs to the user
    // 1. The remaining YES tokens
    mint_outcome(
        &add_liquidity.yes_mint,
        &add_liquidity.user_yes_account,
        market,
        &add_liquidity.token_program,
        user_belonging_yes_tokens,
        &[&[
            b"market",
            market.authority.as_ref(),
            &market.market_number.to_le_bytes(),
            &market.bump.to_le_bytes(),
        ]],
    )?;

    // 2. The LP shares
    mint_outcome(
        &add_liquidity.lp_share_mint,
        &add_liquidity.user_lp_share_account,
        market,
        &add_liquidity.token_program,
        user_belonging_liquidity_shares,
        &[&[
            b"market",
            market.authority.as_ref(),
            &market.market_number.to_le_bytes(),
            &market.bump.to_le_bytes(),
        ]],
    )?;

    // Send the event
    emit!(LiquidityAddedEvent {
        market: market.key(),
        user: add_liquidity.user.key(),
        amount: usd_amount,
        liquidity_shares_gained: user_belonging_liquidity_shares,
        usd_added_to_pool: user_belonging_liquidity_shares,
        yes_added_to_pool: yes_lp_minted,
        no_added_to_pool: usd_amount,
        yes_given_to_user: user_belonging_yes_tokens,
        no_given_to_user: 0,
        yes_minted: usd_amount,
        no_minted: usd_amount,
    });

    // Now we update the pool
    pool.yes_liquidity += yes_lp_minted;
    pool.no_liquidity += usd_amount;
    pool.total_yes_mints += usd_amount;
    pool.total_no_mints += usd_amount;

    // The shares for now don't differ from the value
    pool.liquidity_value = new_liquidity_value;
    pool.liquidity_shares = new_liquidity_value;

    Ok(())
}

#[inline(never)]
fn add_unequal_outcomes_with_more_yes(
    add_liquidity: &mut PoolLiquidity,
    yes_token_price: u64,
    no_token_price: u64,
    usd_amount: u64,
) -> Result<()> {
    let pool = &mut add_liquidity.pool;
    let market = &add_liquidity.market;

    // Total Minted tokens
    let new_no_minted_tokens = pool.no_liquidity + usd_amount;
    let new_yes_minted_tokens = pool.yes_liquidity + usd_amount;

    // if there is more liquidity in the YES pool, it means it is less likely to win
    // therefore, we are going to give back to the user the more probable outcome: NO
    // Pool minted tokens
    let new_lp_yes_minted_tokens = new_yes_minted_tokens; // It is the same being the less probable chance
    let new_lp_no_minted_tokens = (yes_token_price * new_yes_minted_tokens) / no_token_price;
    let liquidity_squared = (new_lp_no_minted_tokens * new_lp_yes_minted_tokens) as u128;
    let new_liquidity_value = sqrt_u128(liquidity_squared) as u64;

    // Now, we calculate what we have to give to the user
    let user_belonging_no_tokens = new_no_minted_tokens - new_lp_no_minted_tokens;
    let user_belonging_liquidity_shares = new_liquidity_value - pool.liquidity_shares;

    // Now, we first mint the YES tokens in the liquidity pool
    mint_outcome(
        &add_liquidity.yes_mint,
        &add_liquidity.liquidity_yes_tokens_account,
        market,
        &add_liquidity.token_program,
        usd_amount,
        &[&[
            b"market",
            market.authority.as_ref(),
            &market.market_number.to_le_bytes(),
            &market.bump.to_le_bytes(),
        ]],
    )?;

    // Then mint the NO tokens to the liquidity pool
    let no_lp_minted = new_lp_no_minted_tokens - pool.no_liquidity;
    mint_outcome(
        &add_liquidity.no_mint,
        &add_liquidity.liquidity_no_tokens_account,
        market,
        &add_liquidity.token_program,
        no_lp_minted,
        &[&[
            b"market",
            market.authority.as_ref(),
            &market.market_number.to_le_bytes(),
            &market.bump.to_le_bytes(),
        ]],
    )?;

    // Then mint what belongs to the user
    // 1. The remaining NO tokens
    mint_outcome(
        &add_liquidity.no_mint,
        &add_liquidity.user_no_account,
        market,
        &add_liquidity.token_program,
        user_belonging_no_tokens,
        &[&[
            b"market",
            market.authority.as_ref(),
            &market.market_number.to_le_bytes(),
            &market.bump.to_le_bytes(),
        ]],
    )?;

    // 2. The LP shares
    mint_outcome(
        &add_liquidity.lp_share_mint,
        &add_liquidity.user_lp_share_account,
        market,
        &add_liquidity.token_program,
        user_belonging_liquidity_shares,
        &[&[
            b"market",
            market.authority.as_ref(),
            &market.market_number.to_le_bytes(),
            &market.bump.to_le_bytes(),
        ]],
    )?;

    // Send the event
    emit!(LiquidityAddedEvent {
        market: market.key(),
        user: add_liquidity.user.key(),
        amount: usd_amount,
        liquidity_shares_gained: user_belonging_liquidity_shares,
        usd_added_to_pool: user_belonging_liquidity_shares,
        yes_added_to_pool: usd_amount,
        no_added_to_pool: no_lp_minted,
        yes_given_to_user: 0,
        no_given_to_user: user_belonging_no_tokens,
        yes_minted: usd_amount,
        no_minted: usd_amount,
    });

    // Now we update the pool
    pool.yes_liquidity += usd_amount;
    pool.no_liquidity += no_lp_minted;
    pool.total_yes_mints += usd_amount;
    pool.total_no_mints += usd_amount;

    // The shares for now don't differ from the value
    pool.liquidity_value = new_liquidity_value;
    pool.liquidity_shares = new_liquidity_value;

    Ok(())
}

// Babylonian method (Heron's method) for unsigned integers
pub fn sqrt_u128(input: u128) -> u128 {
    if input == 0 {
        return 0;
    }

    let mut guess = (input + 1) / 2;
    let mut result = input;

    while guess < result {
        result = guess;
        guess = (input / guess + guess) / 2;
    }

    result
}

#[account]
pub struct MarketFactory {
    pub created_markets: u64,
}

#[account]
pub struct Market {
    pub usd_mint: Pubkey,
    pub yes_mint: Pubkey,
    pub no_mint: Pubkey,
    pub lp_share_mint: Pubkey, // lp mint that is used to represent total shares on a given pool
    pub vault: Pubkey,
    pub authority: Pubkey, // Who can create and do operations on the market
    pub oracle: Pubkey,  // Who can resolve markets and set outcomes
    pub market_number: u64,
    pub resolved: bool,
    pub outcome: Option<u8>, // 0 = No, 1 = Yes,
    pub bump: u8,
}

#[account]
pub struct MarketPool {
    pub liquidity_yes_tokens_account: Pubkey,
    pub liquidity_no_tokens_account: Pubkey,
    pub yes_liquidity: u64,
    pub no_liquidity: u64,
    pub liquidity_value: u64,
    pub liquidity_shares: u64,
    pub usd_collateral: u64,
    pub total_yes_mints: u64,
    pub total_no_mints: u64,
    pub bump: u8,
}

#[event]
pub struct LiquidityAddedEvent {
    pub market: Pubkey,
    pub user: Pubkey,
    pub amount: u64,
    pub liquidity_shares_gained: u64,
    pub usd_added_to_pool: u64,
    pub yes_added_to_pool: u64,
    pub no_added_to_pool: u64,
    pub yes_given_to_user: u64,
    pub no_given_to_user: u64,
    pub yes_minted: u64,
    pub no_minted: u64,
}

#[event]
pub struct LiquidityRemovedEvent {
    pub market: Pubkey,
    pub user: Pubkey,
    pub burnt_lp_shares: u64,
    pub equivalent_usd: u64,
    pub received_lowest_outcome_tokens: u64,
    pub received_lowest_outcome_mint: Pubkey,
    pub remaining_yes_tokens: u64,
    pub remaining_no_tokens: u64,
}

#[event]
pub struct PurchasedOutcomeSharesEvent {
    pub market: Pubkey,
    pub user: Pubkey,
    pub amount: u64,
    pub wanted_shares_purchased: u64,
    pub pool_remaining_yes_tokens: u64,
    pub pool_remaining_no_tokens: u64,
}

#[event]
pub struct MarketResolvedEvent {
    pub market: Pubkey,
    pub solver: Pubkey,
    pub outcome: u8,
}

impl Market {
    // Calculate the required space. Remember: 8 bytes for the discriminator.
    pub const LEN: usize = 8 + 32 * 7 + 8 + 1 + 2 + 1;
}

impl MarketPool {
    // Calculate the required space. Remember: 8 bytes for the discriminator.
    pub const LEN: usize = 8 + 32 * 3 + 8 * 7 + 1;
}

#[derive(Accounts)]
pub struct InitializeMarketFactory<'info> {
    #[account(
        init,
        seeds = [b"market_factory", authority.key().as_ref()],
        bump,
        payer = authority,
        space = 8 + 8
    )]
    pub market_factory: Account<'info, MarketFactory>,

    /// The account that pays for the initialization.
    #[account(mut)]
    pub authority: Signer<'info>,

    /// Programs and sysvars.
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction()]
pub struct InitializeMarket<'info> {
    #[account(
        init,
        seeds = [b"market", authority.key().as_ref(), market_factory.created_markets.to_le_bytes().as_ref()],
        bump,
        payer = authority,
        space = 8 + Market::LEN
    )]
    pub market: Account<'info, Market>,

    // YES Mint
    #[account(
        init,
        seeds = [b"yes_mint", market.key().as_ref()],
        bump,
        payer = authority,
        mint::decimals = 6,
        mint::authority = market,
        mint::freeze_authority = market,
    )]
    pub yes_mint: Account<'info, Mint>,

    // NO Mint
    #[account(
        init,
        seeds = [b"no_mint", market.key().as_ref()],
        bump,
        payer = authority,
        mint::decimals = 6,
        mint::authority = market,
        mint::freeze_authority = market,
    )]
    pub no_mint: Account<'info, Mint>,

    // LP Share Mint
    #[account(
        init,
        seeds = [b"lp_share_mint", market.key().as_ref()],
        bump,
        payer = authority,
        mint::decimals = 6,
        mint::authority = market,
        mint::freeze_authority = market,
    )]
    pub lp_share_mint: Account<'info, Mint>,

    // USD Token (your stable token)
    pub usd_mint: Account<'info, Mint>,

    /// The factory for the market.
    pub market_factory: Account<'info, MarketFactory>,

    /// The vault account where the USD tokens are escrowed.
    /// Its authority is also set to the market PDA.
    #[account(
        init,
        seeds = [b"vault", market.key().as_ref()],
        bump,
        payer = authority,
        token::mint = usd_mint,
        token::authority = market
    )]
    pub vault: Account<'info, TokenAccount>,

    /// The account that pays for the initialization.
    #[account(mut)]
    pub authority: Signer<'info>,

    /// Programs and sysvars.
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct InitializePool<'info> {
    #[account(
        init,
        seeds = [b"pool", market.key().as_ref()],
        bump,
        payer = authority,
        space = 8 + MarketPool::LEN
    )]
    pub pool: Account<'info, MarketPool>,

    /// The liquidity pool yes tokens account.
    #[account(
        init,
        seeds = [b"yes_liquidity_pool", market.key().as_ref()],
        bump,
        payer = authority,
        token::mint = yes_mint,
        token::authority = market
    )]
    pub liquidity_yes_tokens_account: Account<'info, TokenAccount>,

    /// The liquidity pool no tokens account.
    #[account(
        init,
        seeds = [b"no_liquidity_pool", market.key().as_ref()],
        bump,
        payer = authority,
        token::mint = no_mint,
        token::authority = market
    )]
    pub liquidity_no_tokens_account: Account<'info, TokenAccount>,

    /// The market account.
    #[account(mut)]
    pub market: Account<'info, Market>,

    /// The account that pays for the initialization.
    #[account(mut)]
    pub authority: Signer<'info>,

    /// The YES mint
    pub yes_mint: Account<'info, Mint>,

    /// The NO mint
    pub no_mint: Account<'info, Mint>,

    /// Programs and sysvars.
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct PoolLiquidity<'info> {
    #[account(mut)]
    pub pool: Account<'info, MarketPool>,

    #[account(mut, has_one=vault)]
    pub market: Account<'info, Market>,

    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub yes_mint: Account<'info, Mint>,

    #[account(mut)]
    pub no_mint: Account<'info, Mint>,

    #[account(mut)]
    pub lp_share_mint: Account<'info, Mint>,

    #[account(mut)]
    pub user_usd_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_yes_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_no_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_lp_share_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = pool.liquidity_yes_tokens_account == liquidity_yes_tokens_account.key()
    )]
    pub liquidity_yes_tokens_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = pool.liquidity_no_tokens_account == liquidity_no_tokens_account.key()
    )]
    pub liquidity_no_tokens_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(purchased_outcome_mint_pubkey: Pubkey)]
pub struct PurchaseOutcomeShares<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,

    #[account(mut)]
    pub pool: Account<'info, MarketPool>,

    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub yes_mint: Account<'info, Mint>,

    #[account(mut)]
    pub no_mint: Account<'info, Mint>,

    #[account(mut)]
    pub user_usd_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = user_outcome_mint_account.mint == purchased_outcome_mint_pubkey
    )]
    pub user_outcome_mint_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = pool.liquidity_yes_tokens_account == liquidity_yes_tokens_account.key()
    )]
    pub liquidity_yes_tokens_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = pool.liquidity_no_tokens_account == liquidity_no_tokens_account.key()
    )]
    pub liquidity_no_tokens_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ResolveMarket<'info> {
    #[account(mut, has_one = oracle)]
    pub market: Account<'info, Market>,

    /// CHECK: must match `market.oracle`, enforced by `has_one`
    pub oracle: Signer<'info>,
}

#[error_code]
pub enum MarketError {
    #[msg("The amount must be greater than zero.")]
    Zero,
    #[msg("The amount to withdraw is bigger than the account balance.")]
    InsufficientFunds,
    #[msg("The compared mints do no correspond.")]
    UnmatchedMints,
    #[msg("The given mint is not allowed in this transaction.")]
    MintNotAllowed,
    #[msg("The market is already resolved.")]
    MarketResolved,
    #[msg("The market is not resolved yet.")]
    MarketNotResolved,
    #[msg("The market is not initialized.")]
    MarketNotInitialized,
    #[msg("The outcome is invalid.")]
    InvalidOutcome,
}
