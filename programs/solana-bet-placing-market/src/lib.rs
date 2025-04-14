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

    pub fn add_liquidity(ctx: Context<AddLiquidity>, usd_amount: u64) -> Result<()> {
        require!(usd_amount > 0, MarketError::Zero);

        let pool = &mut ctx.accounts.pool;
        let market = &ctx.accounts.market;

        // Transfer the usd to the market vault
        let cpi_accounts = token::Transfer {
            from: ctx.accounts.user_usd_account.to_account_info().clone(),
            to: ctx.accounts.vault.to_account_info().clone(),
            authority: ctx.accounts.user.to_account_info().clone(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, usd_amount)?;

        // Now we are left with

        // 1. Minting the equal number of YES and NO tokens in case
        // the pool has equal chances for both outcomes.
        if pool.yes_liquidity == pool.no_liquidity {
            mint_outcome(
                &ctx.accounts.yes_mint,
                &ctx.accounts.user_yes_account,
                market,
                &ctx.accounts.token_program,
                usd_amount,
                &[&[
                    b"market",
                    market.authority.as_ref(),
                    &market.market_number.to_le_bytes(),
                    &market.bump.to_le_bytes(),
                ]],
            )?;

            mint_outcome(
                &ctx.accounts.no_mint,
                &ctx.accounts.user_no_account,
                market,
                &ctx.accounts.token_program,
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
        }

        // 2. Updating the pool with the new values
        pool.usd_collateral += usd_amount;

        Ok(())
    }
}

fn mint_outcome<'info>(
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

#[account]
pub struct MarketFactory {
    pub created_markets: u64,
}

#[account]
pub struct Market {
    pub usd_mint: Pubkey,
    pub yes_mint: Pubkey,
    pub no_mint: Pubkey,
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

// #[event]
// pub struct LiquidityAddedEvent {
//     pub market: Pubkey,
//
// }

impl Market {
    // Calculate the required space. Remember: 8 bytes for the discriminator.
    // Here we have five Pubkeys (32 bytes each), one bool (1 byte), an Option<u8> (2 bytes), and one u8.
    // Total = 32*5 + 8 + 1 + 2 + 1 = 160 + 12 = 172 bytes.
    pub const LEN: usize = 8 + 32 * 5 + 8 + 1 + 2 + 1;
}

impl MarketPool {
    // Calculate the required space. Remember: 8 bytes for the discriminator.
    // Here we have three Pubkey (32 bytes), seven u64 (8 bytes each), and one u8.
    // Total = 32 * 3 + 8*7 + 1 = 96 + 40 + 1 = 137 bytes.
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

    pub clock: Sysvar<'info, Clock>,
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
    pub user_usd_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_yes_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_no_account: Account<'info, TokenAccount>,

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
