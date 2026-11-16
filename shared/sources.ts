/** Every published source a number or a claim in Breathprint rests on. */
export type Source = {
  title: string;
  publisher: string;
  year: number;
  url: string;
};

export const SOURCES = {
  epaAqi2024: {
    title:
      "Technical Assistance Document for the Reporting of Daily Air Quality (AQI), 2024 PM2.5 update",
    publisher: "US Environmental Protection Agency",
    year: 2024,
    url: "https://document.airnow.gov/technical-assistance-document-for-the-reporting-of-daily-air-quailty.pdf",
  },
  epaNowcast: {
    title: "How is the NowCast algorithm used to report current air quality?",
    publisher: "US Environmental Protection Agency, AirNow",
    year: 2023,
    url: "https://usepa.servicenowservices.com/airnow?id=kb_article_view&sysparm_article=KB0011856",
  },
  cpcbNaqi: {
    title: "National Air Quality Index and AQI calculator",
    publisher: "Central Pollution Control Board, India",
    year: 2014,
    url: "https://app.cpcbccr.com/ccr_docs/FINAL-REPORT_AQI_.pdf",
  },
  whoAqg2021: {
    title: "WHO global air quality guidelines",
    publisher: "World Health Organization",
    year: 2021,
    url: "https://www.who.int/publications/i/item/9789240034228",
  },
  epaEfh2011: {
    title: "Exposure Factors Handbook, Chapter 6: Inhalation Rates, Table 6-2",
    publisher: "US Environmental Protection Agency",
    year: 2011,
    url: "https://www.epa.gov/sites/default/files/2015-09/documents/efh-chapter06.pdf",
  },
  chenZhao2011: {
    title: "Review of relationship between indoor and outdoor particles",
    publisher: "Chen and Zhao, Atmospheric Environment 45(2)",
    year: 2011,
    url: "https://doi.org/10.1016/j.atmosenv.2010.09.048",
  },
  goel2015: {
    title: "On-road PM2.5 pollution exposure in multiple transport microenvironments in Delhi",
    publisher: "Goel et al., Atmospheric Environment 123",
    year: 2015,
    url: "https://doi.org/10.1016/j.atmosenv.2015.10.037",
  },
  cherrie2018: {
    title:
      "Effectiveness of face masks used to protect Beijing residents against particulate air pollution",
    publisher: "Cherrie et al., Occupational and Environmental Medicine 75(6)",
    year: 2018,
    url: "https://doi.org/10.1136/oemed-2017-104765",
  },
  ncceh2023: {
    title:
      "Do-it-yourself air cleaners: evidence on effectiveness and considerations for safe operation",
    publisher: "National Collaborating Centre for Environmental Health, Canada",
    year: 2023,
    url: "https://ncceh.ca/resources/evidence-reviews/do-it-yourself-diy-air-cleaners-evidence-effectiveness-and",
  },
  dalPorto2022: {
    title: "Characterizing the performance of a do-it-yourself (DIY) box fan air filter",
    publisher: "Dal Porto et al., Aerosol Science and Technology 56(6)",
    year: 2022,
    url: "https://doi.org/10.1080/02786826.2022.2054674",
  },
  jetter2002: {
    title: "Characterization of emissions from burning incense",
    publisher: "Jetter et al., Science of the Total Environment 295",
    year: 2002,
    url: "https://doi.org/10.1016/S0048-9697(02)00043-8",
  },
  liu2003: {
    title: "Mosquito coil emissions and health implications",
    publisher: "Liu et al., Environmental Health Perspectives 111(12)",
    year: 2003,
    url: "https://doi.org/10.1289/ehp.6286",
  },
  akagi2011: {
    title: "Emission factors for open and domestic biomass burning for use in atmospheric models",
    publisher: "Akagi et al., Atmospheric Chemistry and Physics 11",
    year: 2011,
    url: "https://doi.org/10.5194/acp-11-4039-2011",
  },
  indiaGhg2015: {
    title: "India Specific Road Transport Emission Factors",
    publisher: "India GHG Program (WRI India, CII, TERI)",
    year: 2015,
    url: "https://shaktifoundation.in/wp-content/uploads/2017/06/WRI-2015-India-Specific-Road-Transport-Emission-Factors.pdf",
  },
  oecd2020: {
    title: "Non-exhaust Particulate Emissions from Road Transport",
    publisher: "OECD",
    year: 2020,
    url: "https://doi.org/10.1787/4a4dc6ca-en",
  },
  unepMetro2014: {
    title: "Case Study of Metro Rail in Indian Cities",
    publisher: "UNEP DTU Partnership",
    year: 2014,
    url: "https://unepccc.org/wp-content/uploads/2014/08/case-study-of-metro-final.pdf",
  },
  ceaCo2v22: {
    title: "CO2 Baseline Database for the Indian Power Sector, Version 22.0",
    publisher: "Central Electricity Authority, India",
    year: 2026,
    url: "https://cea.nic.in/cdm-co2-baseline-database/?lang=en",
  },
  doeIdling: {
    title: "Driving more efficiently: idling",
    publisher: "US Department of Energy, fueleconomy.gov",
    year: 2024,
    url: "https://www.fueleconomy.gov/feg/driveHabits.jsp",
  },
  dmrcFares: {
    title: "Delhi Metro fare chart",
    publisher: "Delhi Metro Rail Corporation",
    year: 2025,
    url: "https://www.delhimetrorail.com/fare",
  },
  berkeleyEarth2015: {
    title: "Air pollution and cigarette equivalence",
    publisher: "Berkeley Earth",
    year: 2015,
    url: "https://berkeleyearth.org/air-pollution-and-cigarette-equivalence/",
  },
  caqmGrap: {
    title: "Graded Response Action Plan for Delhi NCR",
    publisher: "Commission for Air Quality Management in NCR",
    year: 2024,
    url: "https://caqm.nic.in/",
  },
  epaSchools: {
    title: "Air Quality Guidance for Schools and outdoor activity",
    publisher: "US Environmental Protection Agency, AirNow",
    year: 2019,
    url: "https://www.airnow.gov/air-quality-and-health/schools/",
  },
  epaPurifier: {
    title: "Guide to Air Cleaners in the Home",
    publisher: "US Environmental Protection Agency",
    year: 2018,
    url: "https://www.epa.gov/indoor-air-quality-iaq/guide-air-cleaners-home",
  },
  epaPlants: {
    title: "Potted plants do not improve indoor air quality: a review",
    publisher: "Cummings and Waring, Journal of Exposure Science and Environmental Epidemiology 30",
    year: 2020,
    url: "https://doi.org/10.1038/s41370-019-0175-9",
  },
  cdcCo: {
    title: "Carbon monoxide poisoning: prevention",
    publisher: "US Centers for Disease Control and Prevention",
    year: 2024,
    url: "https://www.cdc.gov/carbon-monoxide/prevention/index.html",
  },
  openMeteo: {
    title: "Air Quality API (CAMS forecasts)",
    publisher: "Open-Meteo and Copernicus Atmosphere Monitoring Service",
    year: 2026,
    url: "https://open-meteo.com/en/docs/air-quality-api",
  },
  assumption: {
    title: "Breathprint working assumption, stated with its range",
    publisher: "Breathprint",
    year: 2026,
    url: "https://github.com/Arjunx156/breathprint/blob/main/docs/science.md",
  },
} as const satisfies Record<string, Source>;

export type SourceId = keyof typeof SOURCES;

export function sourceOf(id: SourceId): Source {
  return SOURCES[id];
}
