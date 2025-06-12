export const getAddLiquidityPotentialBenefits = (
    liquidityValue: number,
    yesLiquidity: number,
    noLiquidity: number,
    moneyToAdd: number,
) => {
    if (yesLiquidity === noLiquidity) {
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
    const userBelongingLpShares = newCorrectLiquidityValue - liquidityValue;
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