# Law firm AI search audit worksheet

A static copy of the [original Quoted First worksheet](https://quotedfirst.com/law-firm-ai-search-audit/) for planning questions and recording your own observations from AI search answers.

## Use the worksheet

[Try the hosted project demo](https://agcobra.github.io/law-firm-ai-search-worksheet/) in your browser without running a local server.

1. Enter one practice area and location to prepare seven questions.
2. Run each question yourself in the AI search tool you want to review.
3. Start a run with the firm, search tool, date and settings. Record the answers, source links, firm mentions and accuracy notes you checked.
4. Download completed runs as CSV for spreadsheet review. Download a runs backup as JSON before leaving, then import that backup on a later visit. Use saved questions for a new run when you want to repeat the same review.

The worksheet does not run searches, recommend lawyers, check legal citations or calculate a universal visibility score. A missing mention does not establish that a page is absent from an index.

## Keep your records

Entries stay in memory in the open browser tab. They are not saved automatically or sent to a server by the worksheet. Closing or reloading the tab clears them unless you downloaded a backup. CSV keeps an export for review; the JSON runs backup is the format to import when resuming work. Keep downloaded files in your own chosen storage.

The included example CSV and checklist use illustrative estate-planning questions for Boston, MA. Their observation fields are blank; they contain no search results. These example downloads work without JavaScript. Personalized questions, recording and backup/import require JavaScript.

## Run locally

With Python 3 installed, open a terminal in the folder containing `index.html` and run:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open [http://127.0.0.1:8000/](http://127.0.0.1:8000/) in your browser. Stop the server with Ctrl+C when finished. Use the local server rather than opening the HTML file directly so the JavaScript module loads correctly.

No build step or package installation is needed. Keep the supplied files together; local assets and example downloads use relative paths, including when served from a project subdirectory. The canonical URL remains the [original live worksheet](https://quotedfirst.com/law-firm-ai-search-audit/).
