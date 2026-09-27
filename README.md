# Golden Wishes

A Make-A-Wish-style donation platform working with verified partner associations in
Morocco. Each wish is a concrete need with an anonymized story; donors fund it fully or
in part. A chat assistant powered by **NVIDIA Nemotron** helps donors decide where their
money helps most — available in English, French and Arabic.

Built for the GoMyCode × NVIDIA hackathon, track "AI World Impact".

## Repository layout

```
goldenwishes/                         Web app (front-end + Netlify Functions + AI)
schema_complete.sql                   Base database schema (PostgreSQL)
migrations/
  001_golden_wishes_features.sql      Adds everything the web app needs (see below)
  002_app_role.sql                    Limited database user for the website
generate_seed_data.py                 Generates the demo data
seed_data_final.sql                   Generated the demo data
```

## Setup and running the project

The app lives in [`goldenwishes/`](goldenwishes/). See
**[`goldenwishes/README.md`](goldenwishes/README.md)** for the project explanation,
dependencies, installation, configuration, run commands and model/data setup —
everything needed to get it running.

## Live demo

`https://goldenwishes.netlify.app`

## Team
The fakers
