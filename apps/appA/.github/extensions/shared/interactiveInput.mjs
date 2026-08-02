import {createInterface} from "node:readline/promises";
import {stdin as input, stdout as output} from "node:process";

function formatChoices(choices) {
    if (!Array.isArray(choices) || choices.length === 0) {
        return "";
    }

    return choices.map((choice, index) => `${index + 1}. ${choice}`).join("\n");
}

export async function promptForUserInput(request) {
    const question = String(request?.question ?? "").trim();
    const choices = Array.isArray(request?.choices)
        ? request.choices.filter((choice) => typeof choice === "string")
        : [];

    const rl = createInterface({input, output});

    try {
        if (question) {
            output.write(`\n${question}\n`);
        }

        if (choices.length > 0) {
            output.write(`${formatChoices(choices)}\n`);
        }

        const answer = (await rl.question("Your answer: ")).trim();
        return {
            answer,
            wasFreeform: !choices.includes(answer),
        };
    } finally {
        rl.close();
    }
}
