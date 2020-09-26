/**
 * Throws a message if the requirement is not fulfilled.
 * @param bool
 * @param message
 */
function require(bool, message) {
    if (!bool) {
        throw message;
    }
}

/**
 * Simulates an infinite sum until the result doesn't change significantly or a maximum number of iterations is reached.
 *
 * @param sumFunction {function} a function that maps the current index to the current value to add.
 * @param threshold {number} if the addend is below this value, the sum will return. Default is 0.0001.
 * @param minIterations {number} minimum number of iterations to calculate. Default is 20.
 * @param maxIterations {number} maximum number of iterations to calculate. Default is 5000.
 * @param startIndex {number} where the sum should start. Default is 1.
 * @return {number}
 */
function simulateSumToInfinity(sumFunction, {
                               threshold = 0.0001,
                               minIterations = 20,
                               maxIterations = 5000,
                               startIndex = 1} = {}) {

    let i = startIndex;
    let oldValue = 0;
    let newValue = sumFunction(i);
    let addend = newValue;
    let nextAddend = sumFunction(i + 1);

    do {
        i++;
        oldValue = newValue;
        addend = nextAddend;
        nextAddend = sumFunction(i + 1);
        newValue += addend;
    } while (i < minIterations || (i < maxIterations && (addend > threshold || nextAddend > threshold)))

    return newValue;
}

function formatDouble(value, precision = 2) {
    return value.toFixed(precision);
}

function formatPercentage(value, precision = 1) {
    return (value * 100).toFixed(precision) + " %";
}