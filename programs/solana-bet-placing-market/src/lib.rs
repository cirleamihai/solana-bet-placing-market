use anchor_lang::error_code;
use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
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

    pub fn create_new_market(ctx: Context<InitializeMarket>) -> Result<()> {
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
        pool.market = ctx.accounts.market.key();
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

    #[inline(never)]
    pub fn add_liquidity(ctx: Context<AddLiquidity>, usd_amount: u64) -> Result<()> {
        require!(usd_amount > 0, MarketError::Zero);

        // let pool = &mut ctx.accounts.pool;
        // let market = &ctx.accounts.market;

        // Transfer the usd to the market vault
        let cpi_accounts = token::Transfer {
            from: ctx.accounts.user_usd_account.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, usd_amount)?;

        // 1. Minting the equal number of YES and NO tokens in case
        // the pool has equal chances for both outcomes.
        if ctx.accounts.pool.yes_liquidity == ctx.accounts.pool.no_liquidity {
            add_liquidity_equal_outcomes(
                ctx.accounts,
                usd_amount
            )?;
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
                    usd_amount
                )?;
            } else {
                add_unequal_outcomes_with_more_yes(
                    ctx.accounts,
                    yes_token_price,
                    no_token_price,
                    usd_amount
                )?;
            }
        }

        // 2. Updating the pool with the new values
        ctx.accounts.pool.usd_collateral += usd_amount;

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

#[inline(never)]
fn add_liquidity_equal_outcomes(
    add_liquidity: &mut AddLiquidity,
    usd_amount: u64,
) -> Result<()> {
    let market = & add_liquidity.market;
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
    add_liquidity: &mut AddLiquidity,
    yes_token_price: u64,
    no_token_price: u64,
    usd_amount: u64,
) -> Result<()> {
    let pool = &mut add_liquidity.pool;
    let market = & add_liquidity.market;

    // Total Minted tokens
    let new_no_minted_tokens = pool.no_liquidity + usd_amount;
    let new_yes_minted_tokens = pool.yes_liquidity + usd_amount;

    // if there is more liquidity in the NO pool, it means it is less likely to win
    // therefore, we are going to give back to the user the more probable outcome

    // Pool minted tokens
    let new_lp_no_minted_tokens = new_no_minted_tokens; // It is the same being the less probable chance
    let new_lp_yes_minted_tokens =
        (no_token_price * new_no_minted_tokens) / yes_token_price;
    let liquidity_squared =
        (new_lp_no_minted_tokens * new_lp_yes_minted_tokens) as u128;
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
    add_liquidity: &mut AddLiquidity,
    yes_token_price: u64,
    no_token_price: u64,
    usd_amount:  u64,
) -> Result<()> {
    let pool = &mut add_liquidity.pool;
    let market = & add_liquidity.market;

    // Total Minted tokens
    let new_no_minted_tokens = pool.no_liquidity + usd_amount;
    let new_yes_minted_tokens = pool.yes_liquidity + usd_amount;

    // if there is more liquidity in the YES pool, it means it is less likely to win
    // therefore, we are going to give back to the user the more probable outcome: NO
    // Pool minted tokens
    let new_lp_yes_minted_tokens = new_yes_minted_tokens; // It is the same being the less probable chance
    let new_lp_no_minted_tokens =
        (yes_token_price * new_yes_minted_tokens) / no_token_price;
    let liquidity_squared =
        (new_lp_no_minted_tokens * new_lp_yes_minted_tokens) as u128;
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
    pub authority: Pubkey, // Who can resolve
    pub market_number: u64,
    pub resolved: bool,
    pub outcome: Option<u8>, // 0 = No, 1 = Yes,
    pub bump: u8,
}

#[account]
pub struct MarketPool {
    pub market: Pubkey,
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

impl Market {
    // Calculate the required space. Remember: 8 bytes for the discriminator.
    pub const LEN: usize = 8 + 32 * 6 + 8 + 1 + 2 + 1;
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
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(Accounts)]
#[instruction()]
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
        space = 8 + MarketPool::LEN
    )]
    pub liquidity_yes_tokens_account: Account<'info, TokenAccount>,

    /// The liquidity pool no tokens account.
    #[account(
        init,
        seeds = [b"no_liquidity_pool", market.key().as_ref()],
        bump,
        payer = authority,
        space = 8 + MarketPool::LEN
    )]
    pub liquidity_no_tokens_account: Account<'info, TokenAccount>,

    /// The market account.
    #[account(mut)]
    pub market: Account<'info, Market>,

    /// The account that pays for the initialization.
    #[account(mut)]
    pub authority: Signer<'info>,

    /// Programs and sysvars.
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct AddLiquidity<'info> {
    #[account(mut)]
    pub pool: Account<'info, MarketPool>,

    #[account(mut, has_one = usd_mint, has_one = vault)]
    pub market: Account<'info, Market>,

    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub usd_mint: Account<'info, Mint>,

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

#[error_code]
pub enum MarketError {
    #[msg("The amount must be greater than zero.")]
    Zero,
    #[msg("The market is already resolved.")]
    MarketResolved,
    #[msg("The market is not resolved yet.")]
    MarketNotResolved,
    #[msg("The market is not initialized.")]
    MarketNotInitialized,
}
