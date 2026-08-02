export interface UserInputRequest {
    question?: unknown;
    choices?: unknown[];
}

export interface UserInputResponse {
    answer: string;
    wasFreeform: boolean;
}

export declare function promptForUserInput(request: UserInputRequest): Promise<UserInputResponse>;
