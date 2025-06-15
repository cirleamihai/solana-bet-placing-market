export const getAddLiquidityPotentialBenefits = (
    liquidityShares: number,
    yesLiquidity: number,
    noLiquidity: number,
    moneyToAdd: number,
) => {
    if (yesLiquidity === noLiquidity || moneyToAdd == 0) {
        return {
            lpShares: moneyToAdd,
            yesShares: 0,
            noShares: 0
        }
    }
    const yesPrice = noLiquidity / (yesLiquidity + noLiquidity);
    const noPrice = yesLiquidity / (yesLiquidity + noLiquidity);

    const newYesLiquidity = yesLiquidity + moneyToAdd;
    const newNoLiquidity = noLiquidity + moneyToAdd;
    let newSharesYes, newSharesNo;

    if (newYesLiquidity < newNoLiquidity) {
        newSharesYes = (newNoLiquidity * noPrice) / yesPrice;
        newSharesNo = newNoLiquidity;
    } else {
        newSharesYes = newYesLiquidity;
        newSharesNo = (newYesLiquidity * yesPrice) / noPrice;
    }

    const newCorrectLiquidityValue = Math.sqrt(newSharesYes * newSharesNo);
    const userBelongingLpShares = newCorrectLiquidityValue - liquidityShares;
    if (newYesLiquidity < newNoLiquidity) {
        return {
            lpShares: userBelongingLpShares,
            yesShares: newYesLiquidity - newSharesYes,
            noShares: 0
        }
    } else {
        return {
            lpShares: userBelongingLpShares,
            yesShares: 0,
            noShares: newNoLiquidity - newSharesNo
        }
    }
}

export const getRemoveLiquidityPotentialBenefits = (
    liquidityShares: number,
    yesLiquidity: number,
    noLiquidity: number,
    sharesToRemove: number,
    isMarketResolved: boolean,
    winningOutcome: "yes" | "no"
) => {
    if (yesLiquidity === noLiquidity || sharesToRemove == 0) {
        return {
            moneyToReceive: sharesToRemove,
            yesShares: 0,
            noShares: 0
        }
    }

    if (isMarketResolved) {
        const winningLiquidity = winningOutcome === "yes" ? yesLiquidity : noLiquidity;

        return {
            moneyToReceive: sharesToRemove * winningLiquidity / liquidityShares,
            yesShares: 0,
            noShares: 0
        }
    }

    const lowestOutcomeShares = Math.max(yesLiquidity, noLiquidity);
    const yesPrice = noLiquidity / (yesLiquidity + noLiquidity);
    const noPrice = yesLiquidity / (yesLiquidity + noLiquidity);
    const liquiditySharesUSDValue = liquidityShares / lowestOutcomeShares * sharesToRemove;

    yesLiquidity -= liquiditySharesUSDValue;
    noLiquidity -= liquiditySharesUSDValue;

    let remainingYesShares, remainingNoShares;
    if (noLiquidity > yesLiquidity) { // we are going to give YES shares aswell to balance the pool
        remainingNoShares = yesLiquidity * yesPrice / noPrice;
        remainingYesShares = yesLiquidity;
    } else {
        remainingYesShares = noLiquidity * noPrice / yesPrice;
        remainingNoShares = noLiquidity;
    }
    return {
        moneyToReceive: liquiditySharesUSDValue,
        yesShares: yesLiquidity - remainingYesShares,
        noShares: noLiquidity - remainingNoShares,
    }

}
