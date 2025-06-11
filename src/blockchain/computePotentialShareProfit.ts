export const computePotentialShareProfit = (
    yesLiquidity: number,
    noLiquidity: number,
    purchasesYes: boolean,
    purchasedAmount: number,
) => {
    if (yesLiquidity <= 0 || noLiquidity <= 0 || purchasedAmount <= 0) {
        return 0; // No liquidity means no profit can be made
    }

    // Calculate the constant k
    const k = yesLiquidity * noLiquidity;

    // Calculate the potential profit for a share
    const newUnwantedLiquidity = purchasesYes ?
        noLiquidity + purchasedAmount : yesLiquidity + purchasedAmount;

    const remainingWantedLiquidity = k / newUnwantedLiquidity;

    // Return the potential profit for the purchased amount
    return purchasesYes ?
        yesLiquidity - remainingWantedLiquidity
        : noLiquidity - remainingWantedLiquidity;
}