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
