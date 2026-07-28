# Agentic Memory Artifacts

This repository contains the replication package and evaluation artifacts for the thesis **"Adaptive Context and Memory Management."** 

### Overview
It provides the experimental data, custom prompt structures, and evaluation results used to study how LLM agents organize, interpret, and retrieve contextual memory (spanning memories, knowledge, entities, and insights).

### Structure
* `guidelines/` -- The guidelines used as context-specific knowledge for implementation of MVPs.
* `prompts/` -- Custom prompt structures, context schemas, and modifications.
    - `delivery` -- Prompts used in the delivery pipeline (for coding and requirements agents)
    - `agentic-memory` -- Prompts used in the memory system (for fact extraction and review)
* `results/` -- Raw experimental outputs, evaluation logs, and execution data.