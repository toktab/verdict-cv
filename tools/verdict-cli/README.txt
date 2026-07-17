VERDICT CMD CONNECTOR
=====================

Requirements:

  - Windows 10/11
  - Node.js 22 or newer
  - A running VERDICT server

Run from the project directory:

  verdict.cmd setup
  verdict.cmd login
  verdict.cmd whoami

Optional global installation for the current terminal:

  set PATH=%PATH%;C:\Users\Administrator\IdeaProjects\BrainHack-Project

Then use:

  verdict projects list
  verdict candidates list --project 12
  verdict messages list --folder inbox
  verdict watch

Permanent PATH setup:

  1. Open Windows "Edit environment variables for your account".
  2. Edit Path.
  3. Add the BrainHack-Project directory.
  4. Open a new terminal and run `verdict help`.

Credentials are encrypted using Windows DPAPI and stored under:

  %APPDATA%\VERDICT\credentials.json

The website Profile page lists CMD connectors, IP addresses, access times,
active state, and provides immediate revocation.

Examples
--------

  verdict setup
  verdict login --user toko1 --name "Home PC"
  verdict doctor
  verdict dashboard
  verdict shell
  verdict projects list --search Java
  verdict projects show 3
  verdict candidates upload --project 3 --file "C:\CVs\candidate.pdf"
  verdict candidates show --project 3 12
  verdict audits run --claim-file cv.txt --evidence-file job.txt
  verdict messages send --to reviewer --subject "Candidate review" --body "Please check candidate 12"
  verdict team list --project 3
  verdict activity list --project 3
  verdict signaltrace run --project 3 --candidate 12
  verdict watch messages
  verdict notifications mute 15m
  verdict notifications unmute
  verdict reports audit 42 --format pdf
  verdict reports project --project 3 --out candidates.csv
  verdict batch run tools\verdict-cli\workflow.example.json
  verdict open candidate 3 12
  verdict admin login --user admin
  verdict admin health

Machine-readable output:

  verdict projects list --output json
  verdict candidates list --project 3 --output csv > candidates.csv
  verdict watch --output jsonl

Help:

  verdict help
  verdict help projects

Example batch file
------------------

The included workflow.example.json checks the account, server, projects,
messages, and recent audits. Commands run in order and stop on the first error.

Testing the connector:

  node --test tools\verdict-cli\verdict.test.mjs
