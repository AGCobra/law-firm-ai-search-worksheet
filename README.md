# Law firm AI search audit worksheet

A static copy of the [original Quoted First worksheet](https://quotedfirst.com/law-firm-ai-search-audit/) for planning questions and recording your own observations from AI search answers. The [source files are available on GitHub](https://github.com/AGCobra/law-firm-ai-search-worksheet).

## Use the worksheet

[Try the hosted project demo](https://agcobra.github.io/law-firm-ai-search-worksheet/) in your browser without running a local server.

1. Enter one practice area and location to prepare seven questions.
2. Run each question yourself in the AI search tool you want to review.
3. Start a run with the firm, search tool, date and settings. Record the answers, source links, firm mentions and accuracy notes you checked.
4. To repeat the review, select a saved run and choose **Use these questions for a new run**. Enter the new date and search context, then record fresh observations.
5. Use **Compare two saved runs** to review paired statuses, firm mentions and website links for the same firm, website, practice area, location and exact questions. Choose **View run A** or **View run B** to inspect its recorded answers and sources.
6. Select a run and choose **Download selected run report (HTML)**. Open the downloaded file in your browser, then use its Print command to print or save as PDF.
7. Download all runs as CSV for spreadsheet review. Download a runs backup as JSON before leaving, then import that backup on a later visit.

The comparison keeps your selected A/B order and shows each run’s original tool, settings, date and time zone. Search errors and unrun questions show unavailable classifications; reviewed **No**, **Unclear** and **Not checked** remain distinct. Matching recorded settings do not prove identical conditions, and paired observations do not establish a trend or explain why a result changed.

The worksheet does not run searches, recommend lawyers, check legal citations or calculate a universal visibility score. A missing mention does not establish that a page is absent from an index.

## Keep your records

Entries stay in memory in the open browser tab. They are not saved automatically or sent to a server by the worksheet. Closing or reloading the tab clears them unless you downloaded a backup. CSV exports all runs for spreadsheet review. The selected-run HTML report is a snapshot for reading and printing: it includes the original run context, all seven questions, source URLs, entered answer or error text, notes, and retained drafts. Review its contents before sharing. The report does not update when a run changes. Use the separate JSON runs backup to import and resume editing. Keep downloaded files in your own chosen storage.

The included example CSV and checklist use illustrative estate-planning questions for Boston, MA. Their observation fields are blank; they contain no search results. These example downloads work without JavaScript. Personalized questions, recording, run comparison, report downloads and backup/import require JavaScript.

## Run locally

With Python 3 installed, open a terminal in the folder containing `index.html` and run:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open [http://127.0.0.1:8000/](http://127.0.0.1:8000/) in your browser. Stop the server with Ctrl+C when finished. Use the local server rather than opening `index.html` directly so the worksheet’s JavaScript module loads correctly. Downloaded run reports are standalone HTML files and can be opened directly.

No build step or package installation is needed. Keep the supplied files together; local assets and example downloads use relative paths, including when served from a project subdirectory. The canonical URL remains the [original live worksheet](https://quotedfirst.com/law-firm-ai-search-audit/).
