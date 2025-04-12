use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint, Token, TokenAccount};

declare_id!("3waVbK9Pps4X1ZwS5GbwDQKmX5syrwe6guwnyN3YJfRc");

#[program]
pub mod solana_bet_placing_market {
    use super::*;

    pub fn create_new_market(ctx: Context<InitializeMarket>) -> Result<()> {
        let market = &mut ctx.accounts.market;

        // Store the USD mint and market-specific mint addresses
        // once they have been initialized by the sys
        market.usd_mint = ctx.accounts.usd_mint.key();
        market.yes_mint = ctx.accounts.yes_mint.key();
        market.no_mint = ctx.accounts.no_mint.key();
        market.vault = ctx.accounts.vault.key();
        market.authority = ctx.accounts.authority.key();
        market.bump = ctx.bumps.market;
        market.outcome = None;
        market.resolved = false;

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
        pool.bump = ctx.bumps.pool;

        Ok(())
    }
}

#[account]
pub struct Market {
    pub usd_mint: Pubkey,
    pub yes_mint: Pubkey,
    pub no_mint: Pubkey,
    pub vault: Pubkey,
    pub authority: Pubkey, // Who can resolve
    pub resolved: bool,
    pub outcome: Option<u8>, // 0 = No, 1 = Yes,
    pub bump: u8,
}

impl Market {
    // Calculate the required space. Remember: 8 bytes for the discriminator.
    // Here we have five Pubkeys (32 bytes each), one bool (1 byte), an Option<u8> (2 bytes), and one u8.
    // Total = 32*5 + 1 + 2 + 1 = 160 + 4 = 164 bytes.
    pub const LEN: usize = 8 + 32 * 5 + 1 + 2 + 1;
}

#[derive(Accounts)]
#[instruction()]
pub struct InitializeMarket<'info> {
    #[account(
        init,
        seeds = [b"market", authority.key().as_ref(), clock.unix_timestamp.to_le_bytes().as_ref()],
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

#[account]
pub struct MarketPool {
    pub market: Pubkey,
    pub yes_liquidity: u64,
    pub no_liquidity: u64,
    pub liquidity_value: u64,
    pub liquidity_shares: u64,
    pub usd_collateral: u64,
    pub total_yes_mints: u64,
    pub total_no_mints: u64,
    pub bump: u8,
}

impl MarketPool {
    // Calculate the required space. Remember: 8 bytes for the discriminator.
    // Here we have one Pubkey (32 bytes), seven u64 (8 bytes each), and one u8.
    // Total = 32 + 8*7 + 1 = 32 + 40 + 1 = 73 bytes.
    pub const LEN: usize = 8 + 32 + 8 * 7 + 1;
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

