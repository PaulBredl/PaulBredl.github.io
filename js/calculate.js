/**
 * This class defines a dice.
 *
 * @property name {string} the name of the dice, like 1d6 or 2d8+2
 * @property count {number} the number of dices (number before "d")
 * @property sides {number} number of sides of the dice (number after "d")
 * @property modifier {number} the modifier (number after "+")
 */
class Dice {

    constructor(name, count, sides, modifier) {
        this.name = name;
        this.count = count;
        this.sides = sides;
        this.modifier = modifier;

        require(this.count > 0, "Dice count must be positive");
        require(this.sides >= 2, "Number of sides of a dice must be at least 2");
        require(this.count <= 16, "Dice count may not exceed 32");
        require(this.sides <= 100, "Number of sides may not exceed 100");
    }

    /**
     * Parses a dice from a dice descriptor. Throws an error message of the dice name is illegal.
     * @param name {string} dice descriptor, e.g. "1d8", "2w4+2".
     * @return {Dice}
     */
    static parse(name) {
        const tokens = name.split(new RegExp("[dDwW\+\-]"));
        require(tokens.length >= 2, `Invalid dice description: ${name}`)

        const diceCountString = tokens[0].trim();

        // default count is 1
        const count = diceCountString.length === 0 ? 1 : parseInt(diceCountString);
        // sides of the dice
        const sides = parseInt(tokens[1].trim());
        // optional modifier, default is 0
        const isNegative = name.includes("-");
        let modifier = tokens[2] != null ? parseInt(tokens[2].trim()) : 0;
        if (isNegative) {
            modifier *= -1;
        }

        const prettyName = Dice.prettyName(count, sides, modifier);

        return new Dice(prettyName, count, sides, modifier);
    }

    /**
     * Generates a unified name for a dice. This will return "{count}d{sides}+{modifier}". If the modifier is 0,
     * the last part will be omitted.
     * @return {string} a prettified dice name.
     */
    static prettyName(count, sides, modifier) {
        let prettyName = `${count}d${sides}`;
        if (modifier !== 0) {
            prettyName += (modifier > 0 ? "+" : "-") + Math.abs(modifier);
        }
        return prettyName;
    }

    withCount(count = this.count, sides = this.sides, modifier = this.modifier) {
        return new Dice(Dice.prettyName(count, sides, modifier), count, sides, modifier);
    }
}

/**
 * Simple data class to store the results of the calculator.
 */
class DiceResult {

    constructor(dice, expectedValue, median, variance, standardDeviation, pFail, pGreaterThan, pToWinAgainstOthers) {
        this.dice = dice;
        this.expectedValue = expectedValue;
        this.median = median;
        this.variance = variance;
        this.standardDeviation = standardDeviation;
        this.pFail = pFail;
        this.pGreaterThan = pGreaterThan;
        this.pToWinAgainstOthers = pToWinAgainstOthers;
    }
}

class DiceCalculator {
    // cache calculated values of probabilities to prevent multiple calculations
    // this maps the dice name to an object which maps an integer k to the probability that a dice throw results in k.
    static probabilityLessOrEqualCache = new Map();
    static probabilityEqualCache = new Map();

    constructor(dice, concurringDices = []) {
        this.dice = dice;
        this.concurringDices = concurringDices;
    }

    /**
     * @return {number} the number of "explosions" if the dice throw results in k. For example if the dice is a 1d4
     * and k is 9, this will return 2 since the dice "exploded" two times.
     */
    getExplosionCountForResult(k) {
        return Math.floor(k / this.dice.sides);
    }

    /**
     * Returns the probability the dice throw will result in k.
     *
     * @return {number} a value between 0 and 1
     */
    probabilityForResultEqualTo(k) {
        // check if value was calculated before
        const cache = this.getProbabilityEqualCache();
        if (k in cache) {
            return cache[k];
        }

        let result = this.calculateProbabilityForResultEqualTo(k);

        cache[k] = result;
        return result;
    }

    calculateProbabilityForResultEqualTo(k) {
        const sides = this.dice.sides;
        const count = this.dice.count;
        const modifier = this.dice.modifier;

        const kWithModifier = k;
        const kWithoutModifier = k - modifier;

        let result;
        if (count === 1 && kWithoutModifier % sides === 0 || kWithoutModifier < 0) {
            // result is multiple of the number of sides, which is an impossible value to get
            result = 0;
        } else if (count === 1) {
            // "default" formula for the probability, e.g. for a 1d4 and k = 5 p is 1/16
            result = 1 / (sides ** (this.getExplosionCountForResult(kWithoutModifier) + 1));
        } else {
            // split up in to two dices
            const singleDice = this.dice.withCount(1);
            // ignore modifier on other dice
            const simplerDice = this.dice.withCount(count - 1, sides, 0);
            const singleDiceCalculator = new DiceCalculator(singleDice);
            const simplerDiceCalculator = new DiceCalculator(simplerDice);

            result = 0;
            for (let i = 1; i < kWithModifier; i++) {
                // sum up all possible values to get the result as sum of two dices
                result += singleDiceCalculator.probabilityForResultEqualTo(i)
                    * simplerDiceCalculator.probabilityForResultEqualTo(kWithModifier - i);
            }
        }
        return result;
    }

    probabilityForResultLessOrEqualTo(k) {
        // check if value was calculated before
        const cache = this.getProbabilityLessOrEqualCache();
        if (k in cache) {
            return cache[k];
        }

        // probability for negative values or zero is 0.
        let value = 0;
        if (k > 0 + this.dice.modifier) {
            value = this.probabilityForResultLessOrEqualTo(k - 1) + this.probabilityForResultEqualTo(k);
        }
        cache[k] = value;
        return value;
    }

    probabilityForResultLessThan(k) {
        return this.probabilityForResultLessOrEqualTo(k - 1);
    }

    probabilityForResultGreaterThan(k) {
        return 1 - this.probabilityForResultLessOrEqualTo(k);
    }

    probabilityForResultGreaterOrEqualTo(k) {
        return 1 - this.probabilityForResultLessThan(k);
    }

    calculateProbabilityMap(len = 25) {
        const result = [];
        for (const k of Array(len).keys()) {
            result[k] = this.probabilityForResultGreaterOrEqualTo(k);
        }
        return result;
    }

    calculateExpectedValue() {
        if (this.dice.count === 1) {
            return simulateSumToInfinity(i => i * this.probabilityForResultEqualTo(i),
                {startIndex: this.dice.modifier});
        } else {
            // for multiple dices the calculation can be simplified
            const singleDice = this.dice.withCount(1, this.dice.sides, 0);
            const singleDiceCalculator = new DiceCalculator(singleDice);
            return this.dice.count * singleDiceCalculator.calculateExpectedValue() + this.dice.modifier;
        }
    }

    calculateMedian() {
        for (let i = 1 + this.dice.modifier; ; i++) {
            if (this.probabilityForResultLessOrEqualTo(i) >= 0.5
                && this.probabilityForResultGreaterOrEqualTo(i) >= 0.5) {
                return i;
            } else if (this.probabilityForResultLessOrEqualTo(i) > 0.5) {
                return i - 0.5;
            }
        }
    }

    calculateVariance(exp) {
        if (this.dice.count === 1) {
            return simulateSumToInfinity(
                i => ((exp - i) ** 2) * this.probabilityForResultEqualTo(i),
                {startIndex: this.dice.modifier});
        } else {
            // for multiple dices the calculation can be simplified
            const singleDice = this.dice.withCount(1);
            const singleDiceCalculator = new DiceCalculator(singleDice);
            return singleDiceCalculator.calculateVariance(exp);
        }
    }

    calculateStandardDeviation(variance) {
        return Math.sqrt(variance);
    }

    /**
     * Calculates all values and returns them in a DiceResult object.
     * @return {DiceResult}
     */
    calculate() {
        const expValue = this.calculateExpectedValue();
        const variance = this.calculateVariance(expValue);
        return new DiceResult(
            this.dice,
            expValue,
            this.calculateMedian(),
            variance,
            this.calculateStandardDeviation(variance),
            this.probabilityForResultLessThan(4),
            this.calculateProbabilityMap(),
            this.calculateWinProbabilityMap()
        );
    }

    calculateWinProbabilityMap() {
        return this.concurringDices
            .map(dice => {
                return {
                    diceName: dice.name,
                    probability: this.probabilityToWinAgainst(dice),
                };
            });
    }

    probabilityToWinAgainst(otherDice) {
        const otherCalculator = new DiceCalculator(otherDice);
        return simulateSumToInfinity(i => {
            // the dice "wins" against the other if for each i the other dice is lower
            return this.probabilityForResultEqualTo(i) *
                otherCalculator.probabilityForResultLessThan(i);
        }, {startIndex: Math.min(this.dice.modifier, otherDice.modifier),
            minIterations: this.dice.sides * this.dice.count});
    }

    getProbabilityEqualCache() {
        let cache;
        if (DiceCalculator.probabilityEqualCache.has(this.dice.name)) {
            cache = DiceCalculator.probabilityEqualCache.get(this.dice.name);
        } else {
            cache = {};
            DiceCalculator.probabilityEqualCache.set(this.dice.name, cache);
        }
        return cache;
    }

    getProbabilityLessOrEqualCache() {
        let cache;
        if (DiceCalculator.probabilityLessOrEqualCache.has(this.dice.name)) {
            cache = DiceCalculator.probabilityLessOrEqualCache.get(this.dice.name);
        } else {
            cache = {};
            DiceCalculator.probabilityLessOrEqualCache.set(this.dice.name, cache);
        }
        return cache;
    }
}
