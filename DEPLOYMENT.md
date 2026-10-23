# Dawn Wellness Network website

The replacement is a standalone static site in `docs/`. Its content, branding,
stylesheet and images were copied from the user-provided staging website.
It does not depend on the original website's application or hosting account.

## Develop and preview

Use the existing checkout; each cloud task is already isolated.
No package installation or build is required.

```sh
cd /workspace/Dawn-Inc
python3 -m http.server 8000 --directory docs --bind 0.0.0.0
```

Edit the HTML files in `docs/` and the CSS and JavaScript in `docs/assets/`.
All asset and page links are relative so the GitHub Pages repository path works.

## Visual editing

Open `editor/` under the website's published address, or follow **Edit website**
in any page footer. In development use `/editor/` on the local server above.

1. Choose a page and click text to type on the page, or click an image to replace
   it or change its description. Link destinations appear in the side panel.
2. Use **Preview**, **Desktop**, and **Mobile** to review it. Undo and redo work
   within the current page editing session. Page titles and search descriptions
   are in the side panel. Each page has its own header and footer.
   **Text formatting** offers built-in fonts, sizes from 8–120 pixels, colour,
   bold, italic, underline and alignment. Highlight words for inline formatting,
   or click text to format the selected element. Alignment and **Reset formatting**
   affect its whole paragraph or heading. Reset removes inline formatting while
   preserving the site's default styles and semantic emphasis. Formatting is
   included in drafts, HTML downloads and ZIP exports.
3. Drafts are saved in this browser's local storage. They are not uploaded,
   shared between devices or published. **Discard this page's local draft**
   reloads the published file after confirmation. A warning appears if a draft
   was based on a different version of the published page.
4. Use **Download & publish → Download this page**, then upload the HTML file to
   `docs/` in GitHub, keeping the filename, and commit it to `main`.
5. **Download website ZIP** includes all six pages (using drafts saved in this
   browser), assets and the editor. Extract it before uploading; it contains a
   `docs/` directory. It is also an offline backup of your work.

The editor does not contain GitHub credentials or write access to the repository.
It is public; opening it only edits a visitor's own browser draft. GitHub enforces
authentication and repository write permissions when files are uploaded. There
is no one-click publishing or cross-device draft sync. Uploaded image files are
embedded in the exported HTML; keep them small (maximum 2 MB per upload) to stay
within browser storage limits. Download before clearing browser data.

The editor itself has no runtime dependencies or build step. To run its browser
regression checks, install Playwright in your test environment and run
`node tools/test-editor.cjs`. The test uses `/usr/bin/chromium` when available;
otherwise install Playwright's Chromium with `npx playwright install chromium`.

## Publish with GitHub Pages

1. Push this project to `rasheedsa/Dawn-Inc` on `main`.
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment**, select **Deploy from a branch**.
4. Choose **main** and **/docs**, then click **Save**.
5. Wait for the Pages deployment to finish. Use the URL shown in Settings → Pages.

The expected default address is `https://rasheedsa.github.io/Dawn-Inc/`;
it is not live until Pages is enabled and deployment succeeds.

## Contact and privacy

The staging test form has been replaced with email and phone links. Email opens
the visitor's email application; there is no server submission or delivery claim.
The site stores no inquiries and includes no analytics or embedded maps.
Business facts copied from the staging site should be reviewed by the owner.
Eligibility, referral requirements and availability are directed to the intake
team rather than invented. Privacy and accessibility pages describe this site's
actual features; they do not claim certification or describe unverified internal
organizational policies.
