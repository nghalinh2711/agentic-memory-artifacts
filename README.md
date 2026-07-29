# Agentic Memory Artifacts

This repository contains the replication package and evaluation artifacts for the thesis **"Adaptive Context and Memory Management."** It provides the experimental data, custom prompt structures, guidelines, and evaluation results used to study how agents organize, interpret, and retrieve contextual memory (spanning memories, knowledge, entities, and insights).

> **Note:** This repository hosts evaluation artifacts, prompts, guidelines, and results. It does not contain the closed-source software.

---

## Repository Structure

```
.
├── guidelines/          # Context-specific guidelines used during MVP generation
├── notebooks/           # Jupyter notebooks for generating thesis plots & figures
├── output/              # Output directory for generated plots
├── prompts/             # Custom prompt structures and system instructions
│   ├── agentic-memory/  # Prompts for the memory system (fact extraction, review, etc.)
│   └── delivery/        # Prompts for the delivery pipeline (coding & requirements agents)
└── results/             # Evaluation data and user-study results
    ├── docs/            # User-study form and summarized qualitative results
    └── form-results/    # CSV exports from user-study forms
```

---

## Folder Details

### `guidelines/`
Context-specific guidelines used during the generation of MVPs:
- `coding-guidelines.md` — Coding conventions and standards applied during implementation.
- `design-guidelines.md` — Design principles and architectural patterns followed.
- `testing-guidelines.md` — Testing strategies and quality assurance practices.

### `prompts/`
Custom prompt structures, context schemas, and system instructions used in the implementation.

**`agentic-memory/`** — Prompts for the memory management system.
**`delivery/`** — Prompts for the delivery pipeline (coding and requirements agents).

### `notebooks/`
Jupyter notebooks used to generate all thesis plots and figures:
- `plots.ipynb` — Quantitative evaluation plots and charts.
- `programming.ipynb` — Programming-task-specific analysis and visualizations.
- `qualitative.ipynb` — Qualitative analysis and user-study visualizations.

### `output/`
Placeholder directory where generated plots are written to by the notebooks.

### `results/`
Data from and for the evaluation:
- `docs/form.md` — The user-study questionnaire form.
- `docs/qualitative_results.md` — Summarized qualitative findings from the user study.
- `form-results/appA.csv` — User-study responses for Application A.
- `form-results/appB.csv` — User-study responses for Application B.
- `form-results/background.csv` — Participant background/demographic data.

---

## Setup & Installation

To run the analysis and plot-generation notebooks:

```bash
git clone https://github.com/yourusername/agentic-memory-artifacts.git
cd agentic-memory-artifacts

python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Then open the notebooks in the `notebooks/` directory with Jupyter or VS Code and run them to regenerate the plots (output to `output/`).

---

## Citation

```bibtex
@misc{yourname_2026_agentic_memory,
  author       = {Your Full Name},
  title        = {Replication Artifacts for Adaptive Context and Memory Management},
  year         = {2026},
  publisher    = {Zenodo},
  doi          = {10.5281/zenodo.XXXXXXX},
  url          = {https://doi.org/10.5281/zenodo.XXXXXXX}
}
```