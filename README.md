# Pool Dose Calculator

A static, local web app for converting pool test readings into practical chemical amounts.

Open `index.html` in a browser. No install step is required.

## What it handles

- Sanitiser profiles: chlorine, salt chlorinated, and bromine.
- Basic test set: free chlorine, total chlorine, combined chlorine, and pH.
- Full test set: adds total alkalinity, calcium hardness, stabilizer/CYA, and salt in ppm.
- Paste parsing for Spin Disk-style result text.
- Editable product strengths and target levels.

## Calculation notes

The app uses local formulas rather than an external dosing API. Chlorine, bromine, CYA, hardness, and salt doses are mostly ppm mass-balance calculations:

- `1 ppm = 1 mg/L`.
- Liquid chlorine assumes percent available chlorine as grams per 100 mL.
- Granular chlorine and bromine assume percent available sanitizer by weight.
- Salt, CYA, calcium chloride, and sodium bicarbonate doses scale from ppm rise and pool volume.

pH and alkalinity acid doses are practical approximations because real acid demand changes with alkalinity, borates, temperature, dissolved solids, and product composition. The app deliberately phrases large TA reductions as staged acid/aeration work rather than a single dump-in dose.

## API finding

I did not find a broadly accepted public pool-chemistry dosing API that would be safer to depend on than transparent local formulas. There are device/result APIs such as iopool's REST API and PoolWaterLAB's integration APIs, but those are primarily for retrieving measurements from their hardware ecosystems, not a universal dosage engine.

Useful references:

- CDC home pool guidance: https://www.cdc.gov/healthy-swimming/about/home-pool-and-hot-tub-water-treatment-and-testing.html
- CDC public pool operations overview: https://www.cdc.gov/healthy-swimming/toolkit/operating-public-pools-hot-tubs-and-splash-pads.html
- NSW Health public pool advisory document: https://www.health.nsw.gov.au/environment/Publications/Swimming-Pool-and-Spa-Advisory-doc.pdf
- iopool public API: https://help.iopool.com/en/articles/5537423-iopool-public-api
- PoolWaterLAB API page: https://www.poolwaterlab.us/pages/api-poolwaterlab

Always follow product labels, equipment manuals, and local requirements. Retest after circulation before adding a second correction.
