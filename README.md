# LocalFind

Find concerts, games, and shows happening near you. LocalFind searches the Ticketmaster Discovery API, maps the results, and saves favorites in this browser.

## Live site

https://localfind-fb.web.app

Search on the live site runs through a Cloud Function. The API key stays in that function, not in the page.

## Run

1. Create a free app key at [developer.ticketmaster.com](https://developer.ticketmaster.com/).
2. Copy `.env.example` to `.env` and set `TICKETMASTER_API_KEY`.
3. Install and start the app:

```bash
npm install
npm run dev
```

Open the URL Vite prints. Choose **Use my location**, or search a city such as `Austin, TX`.

The API key stays on the Vite server. The page only calls `/api/events`.

## Scripts

- `npm run dev` — local site and the Ticketmaster proxy
- `npm run build` — typecheck and production build
- `npm run preview` — serve the build with the same proxy
- `npm run lint` — lint the project
- `npm run deploy` — publish the site and the search function

## What you can do

- Search by keyword
- Filter by tonight, this weekend, the next 7 days, or the next 30 days
- Filter by music, sports, arts and theatre, film, or miscellaneous
- Set a radius when you use your location
- Switch between the list and the map
- Save events on this device
