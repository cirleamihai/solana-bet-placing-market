mod market_accounts;

use anchor_lang::prelude::*;
use crate::market_accounts::InitializeMarket;

declare_id!("3waVbK9Pps4X1ZwS5GbwDQKmX5syrwe6guwnyN3YJfRc");

#[program]
pub mod solana_bet_placing_market {
    use super::*;

    pub fn initialize(ctx: Context<InitializeMarket>) -> Result<()> {
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
}

#[derive(Accounts)]
pub struct Initialize {}
