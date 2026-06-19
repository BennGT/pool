# RNW Poolz

A static Rock N Water Landscapes pool dose calculator for converting pool test readings into practical chemical amounts.

Open `index.html` in a browser. No install step is required.

The app uses the Rock N Water Landscapes logo and a matching rust, orange-red, blue, black, and white interface theme.
It includes app icons, a web app manifest, and a service worker so it can be added to the home screen on iOS and installed as a web app on Android/Chrome.
The app also includes an Install App menu tab with platform-specific install prompts and home-screen instructions.

## What it handles

- Pool types: chlorine, salt, and bromine.
- Pool profiles: Chiller 7,500 L, Indoor Plunge 4,500 L, Indoor Swimming Pool 150,000 L, and a Custom Pool option.
- Volume calculator for length, width, and average depth.
- Pool surface is fixed internally as concrete for RNW dosing.
- Pool volume and volume calculator use metric litres and metres.
- Test result display uses ppm.
- Daily test set: free chlorine, total chlorine, combined chlorine, and pH.
- Weekly test set: adds total alkalinity, calcium hardness, stabiliser/CYA where used, salt for salt pools, and temperature.
- Combined chlorine is automatically calculated as `total chlorine - free chlorine`.
- Editable product strengths and target levels, saved in the browser for later use.
- Hamburger menu access to calculator, targets, chemicals, history, safety/reference, and install.
- Dose cards explain what each chemical does to the water and include short action steps for out-of-target readings.
- Local history saves test logs with simple trend charts.

## Calculation notes

The app uses local formulas rather than an external dosing API. Chlorine, bromine, CYA, hardness, and salt doses are mostly ppm mass-balance calculations:

- Test readings are entered and displayed in ppm.
- Liquid chlorine assumes percent available chlorine as grams per 100 mL.
- Granular chlorine and bromine assume percent available sanitizer by weight.
- Chlorine Out defaults to 985 g/kg sodium thiosulphate and uses a staged estimate of about 15 g per 10,000 L to lower free chlorine by 1 ppm.
- Salt, CYA, calcium chloride, and sodium bicarbonate doses scale from ppm rise and pool volume.

pH and alkalinity acid doses are practical approximations because real acid demand changes with alkalinity, borates, temperature, dissolved solids, and product composition. The app deliberately phrases large TA reductions as staged acid/aeration work rather than a single dump-in dose.

## Victorian defaults

Targets are editable, but the preset is based on Victorian Government public aquatic facility guidance:

- Free chlorine defaults to 1.5 ppm for non-stabilised chlorine pools, above the 1.0 ppm minimum.
- Salt/outdoor chlorine defaults to 2.0 ppm free chlorine, matching the minimum where cyanuric acid is used.
- Combined chlorine action level defaults to 1.0 ppm, with an ideal note of less than 0.2 ppm.
- pH defaults to 7.5 for chlorine pools inside the 7.2-7.8 range, and 7.6 for bromine pools inside the 7.2-8.0 range.
- Bromine defaults to 4.0 ppm inside the 2-8 ppm range.
- CYA defaults to 30 ppm only where the active pool profile allows stabiliser. Indoor Plunge and Indoor Swimming Pool hide CYA because the Victorian guide says cyanuric acid should not be used in indoor pools.
- Calcium hardness is handled as part of LSI water balance. The Victorian guide states LSI should be between -0.5 and +0.5 and gives an example of ideal balance at pH 7.4, total alkalinity 100 ppm, calcium hardness 250 ppm, and 29 C.

Salt target is still editable because salt chlorinator manufacturers set their own operating range.

## API finding

I did not find a broadly accepted public pool-chemistry dosing API that would be safer to depend on than transparent local formulas. There are device/result APIs such as iopool's REST API and PoolWaterLAB's integration APIs, but those are primarily for retrieving measurements from their hardware ecosystems, not a universal dosage engine.

Useful references:

- CDC home pool guidance: https://www.cdc.gov/healthy-swimming/about/home-pool-and-hot-tub-water-treatment-and-testing.html
- CDC public pool operations overview: https://www.cdc.gov/healthy-swimming/toolkit/operating-public-pools-hot-tubs-and-splash-pads.html
- NSW Health public pool advisory document: https://www.health.nsw.gov.au/environment/Publications/Swimming-Pool-and-Spa-Advisory-doc.pdf
- iopool public API: https://help.iopool.com/en/articles/5537423-iopool-public-api
- PoolWaterLAB API page: https://www.poolwaterlab.us/pages/api-poolwaterlab

Always follow product labels, equipment manuals, and local requirements. Retest after circulation before adding a second correction.
