#!/usr/bin/env python3
"""Clone student programming-exercise repositories from the Artemis benchmark
instance using student credentials (username + personal-access token).

Each repository URL follows this pattern:
    https://<user>:<token>@<host>/git/ICSE27BENCHMARK{TERM}FINAL{XX}/
    icse27benchmark{term_lower}final{xx}-<user>.git

Examples:
  - ST21 / final 01 → ICSE27BENCHMARKST21FINAL01 / icse27benchmarkst21final01
  - WT2122 / final 02 → ICSE27BENCHMARKWT2122FINAL02 / icse27benchmarkwt2122final02

Usage:
    # Clone a single exercise repo
    python clone_student_repos.py --term ST21 --final 01 --out-dir ./repos

    # Clone multiple
    python clone_student_repos.py --term ST21 --final 01 \\
                                  --term WT2122 --final 02 \\
                                  --out-dir ./repos

    # Interactive TUI (prompts for missing values)
    python clone_student_repos.py --tui
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path
from typing import Optional
from urllib.parse import quote

import prompts
from artemis_client import ArtemisError, die
from config import load_env, resolve


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument("--host", help="Artemis Git host (or ARTEMIS_GIT_HOST)")
    p.add_argument("--user", help="Student login (or ARTEMIS_STUDENT_USER)")
    p.add_argument("--token", help="Personal access token (or ARTEMIS_STUDENT_TOKEN)")
    p.add_argument("--out-dir", type=Path, help="Where to clone (default ./student-repos)")
    p.add_argument(
        "--term",
        action="append",
        dest="terms",
        help="Term identifier, e.g. ST21 or WT2122 (repeatable, paired with --final)",
    )
    p.add_argument(
        "--final",
        action="append",
        dest="finals",
        help="Final exam number, e.g. 01 or 02 (repeatable, paired with --term)",
    )
    p.add_argument("--env-file", type=Path)
    p.add_argument(
        "--tui",
        action="store_true",
        help="Interactive prompts for missing fields (default when no args)",
    )
    args = p.parse_args()
    if len(sys.argv) == 1:
        args.tui = True
    return args


def run_tui(cfg: dict, pairs: list[tuple[str, str]]) -> tuple[dict, list[tuple[str, str]]]:
    """Prompt interactively for missing configuration and term/final pairs."""
    if not cfg.get("host"):
        cfg["host"] = prompts.text(
            "Artemis Git host",
            default="artemis-benchmark.vdl-ws.sdq.kastel.kit.edu",
            required=True,
        )
    if not cfg.get("user"):
        cfg["user"] = prompts.text("Student login", default="halinh.nguyen", required=True)
    if not cfg.get("token"):
        cfg["token"] = prompts.password("Personal access token")
    if not pairs:
        print("\nEnter term/final pairs (leave term blank to finish):")
        while True:
            term = prompts.text("  Term (e.g. ST21, WT2122)")
            if not term.strip():
                break
            final = prompts.text("  Final (e.g. 01, 02)", required=True)
            pairs.append((term.strip().upper(), final.strip().zfill(2)))
    return cfg, pairs


def build_clone_url(host: str, user: str, token: str, term: str, final: str) -> tuple[str, str]:
    """Build the clone URL and a printable (redacted) version for logging.

    Returns (clone_url, printable_url).
    """
    term_upper = term.upper()
    term_lower = term.lower()
    final_padded = final.zfill(2)

    course = f"ICSE27BENCHMARK{term_upper}FINAL{final_padded}"
    repo = f"icse27benchmark{term_lower}final{final_padded}-{user}"

    # URL-encode credentials so special characters don't break the URL.
    encoded_user = quote(user, safe="")
    encoded_token = quote(token, safe="")

    # URL with embedded credentials for git
    clone_url = f"https://{encoded_user}:{encoded_token}@{host}/git/{course}/{repo}.git"
    # Redacted version for logging
    printable = f"https://{user}:<token>@{host}/git/{course}/{repo}.git"

    return clone_url, printable


def git_clone(clone_url: str, dest: Path, printable_url: str) -> None:
    """Clone *clone_url* into *dest*, skipping if the directory already exists
    and is non-empty."""
    if dest.exists() and any(dest.iterdir()):
        print(f"    skip: {dest} already exists and is non-empty")
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    cmd = ["git", "clone", clone_url, str(dest)]
    print(f"    $ git clone {printable_url} {dest}")
    env = os.environ.copy()
    env["GIT_TERMINAL_PROMPT"] = "0"
    result = subprocess.run(cmd, env=env, capture_output=True, text=True)
    if result.returncode != 0:
        raise ArtemisError(f"git clone failed: {result.stderr.strip()}")


def main() -> None:
    args = parse_args()
    env = load_env(args.env_file)

    cfg: dict = {
        "host": resolve(env, "host", args.host),
        "user": resolve(env, "user", args.user),
        "token": resolve(env, "token", args.token),
    }

    # Collect term/final pairs from CLI args
    pairs: list[tuple[str, str]] = []
    if args.terms or args.finals:
        cli_terms = args.terms or []
        cli_finals = args.finals or []
        if len(cli_terms) != len(cli_finals):
            die("--term and --final must be given the same number of times")
        pairs = list(zip(cli_terms, cli_finals))

    if args.tui:
        cfg, pairs = run_tui(cfg, pairs)

    missing = [k for k in ("host", "user", "token") if not cfg.get(k)]
    if missing:
        die("missing required values: " + ", ".join(missing)
            + "\nSet them via --host/--user/--token flags, .env file, or --tui.")

    # Guard against an empty token — git would fail with a confusing
    # "Authentication failed" message instead of a clear error.
    token_val: str = cfg["token"]
    if not token_val.strip():
        die("token is empty — set ARTEMIS_STUDENT_TOKEN in .env or pass --token")

    if not pairs:
        die("no term/final pairs specified — use --term/--final or --tui")

    out_dir: Path = args.out_dir or Path("./student-repos")

    print(f"Host:    {cfg['host']}")
    print(f"User:    {cfg['user']}")
    print(f"Out dir: {out_dir}")
    print(f"Repos to clone: {len(pairs)}")
    print()

    ok = 0
    failures: list[str] = []
    for term, final in pairs:
        term_upper = term.upper()
        final_padded = final.zfill(2)
        label = f"{term_upper}FINAL{final_padded}"
        print(f"- {label}")

        clone_url, printable_url = build_clone_url(
            cfg["host"], cfg["user"], cfg["token"], term, final
        )
        dest = out_dir / label.lower()

        try:
            git_clone(clone_url, dest, printable_url)
        except ArtemisError as exc:
            print(f"    {exc}")
            failures.append(f"{label}: clone failed")
            continue
        ok += 1

    print(f"\nDone: {ok} cloned, {len(failures)} failed.")
    if failures:
        print("Failures:")
        for f in failures:
            print(f"  - {f}")
        sys.exit(2)


if __name__ == "__main__":
    main()
