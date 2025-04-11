use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint, Token, TokenAccount};

#[account]
pub struct Market {
    pub usd_mint: Pubkey,
    pub yes_mint: Pubkey,
    pub no_mint: Pubkey,
    pub vault: Pubkey,
    pub authority: Pubkey, // Who can resolve
    pub resolved: bool,
    pub outcome: Option<u8>, // 0 = No, 1 = Yes
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

    /// CHECK: just an associated token account owned by market PDA
    #[account(
        init,
        seeds = [b"vault", market.key().as_ref()],
        bump,
        payer = authority,
        token::mint = usd_mint,
        token::authority = market
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}