# Architecture

- `index.html` provides the page structure, navigation, task dialog, and accessible controls.
- `styles.css` provides the responsive visual layout and light or dark color modes.
- `app.js` holds the task data, saves it in the browser, and updates each interactive view.
- `README.md` explains the project, how to open it, and the design acknowledgment.
- `CONTEXT.md` records the current stage and important project choices.

`index.html` loads `styles.css` for presentation and `app.js` for behavior. `app.js` updates the dynamic page areas in `index.html` and stores data in the browser's local storage.

The project is intentionally static so it can run by opening one file, and it uses local storage to keep personal task data on the user's device.
