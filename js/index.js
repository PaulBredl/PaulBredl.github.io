function diceNamesToCells(results) {
    return results
        .map(result => result.dice.name)
        .map(diceName => "<th>" + diceName + "</th>")
        .join("");
}

function createTitleRow(results) {
    return `<thead class="thead-dark">
        <tr>
            <th scope="col">Dice</th>
            ${createCells(results, results => results.dice.name, "th")}
        </tr>
    </thead>`;
}

function createCells(results, resultToValueMapper, htmlTag = "td") {
    return results
        .map(result => resultToValueMapper(result))
        .map(value => `<${htmlTag}>${value}</${htmlTag}>`)
        .join("");
}

function createBasicRow(name, results, resultToValueMapper) {
    return `
        <tr>
            <th scope="row">${name}</th>
            ${createCells(results, resultToValueMapper)}
        </tr>
    `;
}

function createProbabilityRows(results) {
    let result = "";
    for (let i = 4; i < 25; i += 4) {
        result += createBasicRow(`P(X >= ${i})`, results,
                result => formatPercentage(result.pGreaterThan[i]));
    }
    return result;
}

function createWinProbabilityTitleRow(results) {
    return `
            <tr>
                <th scope="col" class="table-dark" colspan=${results.length + 1}>Win probability...</th>
            </tr>
        `;
}

function createWinProbabilityColumns(currentIndex, results, name) {
    return createBasicRow("...against " + name, results, result => {
        return formatPercentage(result.pToWinAgainstOthers[currentIndex].probability);
    })
}

function createWinProbabilityRows(results) {
    return results
        .map((result, index) => createWinProbabilityColumns(index, results, result.dice.name))
        .join("");
}

function generateResultTable(results) {
    return `
                ${createTitleRow(results)}
                <tbody>
                    ${createBasicRow("Expected value", results, 
            result => formatDouble(result.expectedValue))}
                    ${createBasicRow("Median", results,
        result => formatDouble(result.median))}
                    ${createBasicRow("Variance", results, 
        result => formatDouble(result.variance))}
                    ${createBasicRow("Standard deviation", results,
                       result => formatDouble(result.standardDeviation))}
                    ${createBasicRow("P(X < 4)", results, 
            result => formatPercentage(result.pFail))}
                    ${createProbabilityRows(results)}
                    ${createWinProbabilityTitleRow(results)}
                    ${createWinProbabilityRows(results)}
                </tbody>
            `;
}

function calculateRequest() {
    try {
        const calculateEdit = document.getElementById("calculateEdit");
        calculateEdit.classList.remove("is-invalid");
        const request = "" + calculateEdit.value;

        // parse dices
        const diceStrings = request.split("vs");
        require(diceStrings.length <= 10, "The maximum amount of dices to compare is 10");
        const dices = diceStrings.map(diceStr => Dice.parse(diceStr));

        // calculate results
        const results = dices.map(dice => new DiceCalculator(dice, dices).calculate());

        // show results
        document.getElementById("resultTable").innerHTML = generateResultTable(results);
    } catch (e) {
        document.getElementById("calculateEdit").classList.add("is-invalid");
        document.getElementById("invalidInputFeedback").innerText = e;
    }

    // prevent page reload
    return false;
}

window.onload = () => {
    document.getElementById("calculateEdit").focus();
    document.onsubmit = () => calculateRequest();
}