# Scan eval photos

Five real rooms for the room-scan evals, all CC0 from Wikimedia Commons, shrunk to 1280 px with their metadata stripped. `kitchen-hob.jpg` doubles as the demo's sample kitchen in `web/public/samples/kitchen.jpg`.

| File                 | Commons source                                                                                             | Author      | Licence |
| -------------------- | ---------------------------------------------------------------------------------------------------------- | ----------- | ------- |
| `kitchen-hob.jpg`    | [Kitchen in Earthship Brighton](https://commons.wikimedia.org/wiki/File:Kitchen_in_Earthship_Brighton.jpg) | Andy Li     | CC0     |
| `kitchen-hood.jpg`   | [Kitchen Fitting (6)](https://commons.wikimedia.org/wiki/File:Kitchen_Fitting_(6).JPG)                     | Kokotai     | CC0     |
| `incense.jpg`        | [Incense in India](https://commons.wikimedia.org/wiki/File:Incense_in_India.jpg)                           | 4174332     | CC0     |
| `bedroom-window.jpg` | [Open bedroom window in Paris](https://commons.wikimedia.org/wiki/File:Open_bedroom_window_in_Paris.jpg)   | John Towner | CC0     |
| `brazier.jpg`        | [Brazier carrying coals](https://commons.wikimedia.org/wiki/File:Brazier_carrying_coals.jpg)               | Davidbena   | CC0     |

The cases in `evals/cases.ts` say what each photo must show and what it must not. If you swap a photo, rerun `just eval` and `just record`, since the demo's saved reading is keyed by the sample's hash.
