export const analysisStates = [
    {
        id: 'light',
        name: 'Light State',
        shortName: 'Light',
        strategy: 'Local / lenient',
        description: 'Fast deterministic screening that preserves reasonable wording and flags clear evidence gaps.',
    },
    {
        id: 'war',
        name: 'WAR State',
        shortName: 'WAR',
        strategy: 'Local / evidence-first',
        description: 'Deterministic evidence pressure for serious claims, inflated wording, and incomplete proof.',
    },
    {
        id: 'person',
        name: 'Person_AI State',
        shortName: 'Person_AI',
        strategy: 'AI / contextual',
        description: 'Human-style contextual review that recognizes paraphrases and transferable evidence.',
    },
    {
        id: 'strict-war-ai',
        name: 'WAR_AI State',
        shortName: 'WAR_AI',
        strategy: 'Hybrid / strict',
        description: 'Conservative local WAR analysis cross-checked by AI, keeping the stricter verdict.',
    },
];
