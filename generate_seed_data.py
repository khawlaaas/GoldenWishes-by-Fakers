"""
GOLDEN WISHES — Fake data generator (Faker)
--------------------------------------------------------
Generates realistic fake data for the tables:
organizations, beneficiaries, wishes, donors, donations

Produces two outputs:
  1) seed_data.sql   -> run directly against Postgres (INSERT INTO...)
  2) seed_data.json  -> handy if your teammate wants to load it straight
                         into Python for the RAG pipeline

Usage:
    python3 generate_seed_data.py
"""

import json
import random
import uuid
from datetime import datetime, timedelta
from faker import Faker

fake = Faker("en_US")
random.seed(42)  # reproducibility

# ------------------------------------------------------------
# Realistic reference data (Morocco / Casablanca context)
# ------------------------------------------------------------

CITIES_REGIONS = [
    ("Casablanca", "Casablanca-Settat"),
    ("Rabat", "Rabat-Sale-Kenitra"),
    ("Marrakech", "Marrakech-Safi"),
    ("Fes", "Fes-Meknes"),
    ("Tangier", "Tanger-Tetouan-Al Hoceima"),
    ("Agadir", "Souss-Massa"),
    ("Oujda", "L'Oriental"),
]

ORG_TYPES = ["orphanage", "hospital", "ngo", "community_center", "legal_guardian"]

ORG_NAME_TEMPLATES = [
    "{city} Association for Children",
    "Al Amal Orphanage - {city}",
    "{city} Children's Hospital",
    "Ennour Community Center {city}",
    "Hope Foundation {city}",
    "Karama NGO for Children {city}",
]

RELAY_POINT_TEMPLATES = [
    "Relay point — ENSAM {city}",
    "Relay point — Faculty of Sciences {city}",
    "Relay point — {city} City Hall",
    "Relay point — {city} Public Library",
]

CATEGORIES = ["education", "essentials", "creative", "family_care", "health", "clothing", "technology", "sport"]

URGENCY_LEVELS = ["low", "medium", "high", "critical"]
URGENCY_WEIGHTS = [0.30, 0.35, 0.25, 0.10]  # realistic distribution

SITUATIONS = ["orphan", "family_in_difficulty", "chronic_illness", "hospitalization", "temporary_placement"]

# Bank of typical "wishes" (title, description, category, approx cost, tags)
WISH_TEMPLATES = [
    ("A school bag, fully stocked", "Notebooks, pens, a compass set, and a bag sturdy enough to last the whole year.",
     "education", (200, 300), ["school", "supplies", "back-to-school"]),
    ("A wool blanket for winter", "Thick enough for a cold night without heating.",
     "essentials", (150, 220), ["winter", "comfort", "urgent"]),
    ("A drawing set for a child who draws every day", "Colored pencils, a sketchpad, and a box of paints.",
     "creative", (100, 180), ["creativity", "hobby"]),
    ("Three months of infant formula", "One tin a month, for a baby whose family is between jobs.",
     "family_care", (300, 450), ["baby", "nutrition", "urgent"]),
    ("A full set of school books", "This year's required textbooks, bought new so nothing is missing.",
     "education", (350, 500), ["school", "textbooks"]),
    ("Two weeks of groceries, family of five", "Enough to cook full meals for two weeks.",
     "essentials", (400, 600), ["food", "family", "urgent"]),
    ("A course of physical therapy", "Ten rehabilitation sessions needed after a surgery.",
     "health", (800, 1200), ["health", "medical", "critical"]),
    ("A pair of prescription glasses", "For a child who can no longer read the whiteboard in class.",
     "health", (250, 400), ["health", "vision"]),
    ("A winter coat that fits", "Hers is torn and outgrown from last year.",
     "clothing", (150, 250), ["winter", "clothing"]),
    ("A tablet for remote classes", "Also used by the shelter for evening tutoring sessions.",
     "technology", (1500, 2200), ["education", "technology"]),
    ("A ball and a pair of football boots", "For the kid who dreams of joining the neighborhood team.",
     "sport", (200, 350), ["sport", "hobby"]),
    ("A month of chronic illness medication", "Essential medication to cover one month of treatment.",
     "health", (500, 900), ["health", "critical", "medical"]),
]

NICKNAMES = ["Amara", "Youssef", "Salma", "Adam", "Lina", "Rayan", "Nour", "Yasmine",
             "Ilyas", "Kenza", "Zayd", "Malak", "Hamza", "Sara", "Anas", "Imane"]


def clean_phone():
    """Generate a short, consistent phone number (avoids Faker's occasional
    long extensions like 'x1234' that overflow narrow VARCHAR columns)."""
    return f"+212 6{random.randint(10000000, 99999999)}"


def urgency_from_category(category):
    if category == "health":
        return random.choices(["high", "critical"], weights=[0.5, 0.5])[0]
    return random.choices(URGENCY_LEVELS, weights=URGENCY_WEIGHTS)[0]


def gen_organizations(n=8):
    orgs = []
    for _ in range(n):
        city, region = random.choice(CITIES_REGIONS)
        org_type = random.choice(ORG_TYPES)
        name = random.choice(ORG_NAME_TEMPLATES).format(city=city)
        relay = random.choice(RELAY_POINT_TEMPLATES).format(city=city)
        orgs.append({
            "id": str(uuid.uuid4()),
            "name": name,
            "org_type": org_type,
            "contact_name": fake.name(),
            "contact_phone": clean_phone(),
            "contact_email": fake.company_email(),
            "city": city,
            "region": region,
            "relay_point": relay,
            "is_verified": random.random() < 0.85,  # 85% verified, to also show the unverified case
            "verification_doc_url": f"https://verify.goldenwishes.org/docs/{uuid.uuid4()}",
            "created_at": fake.date_time_between(start_date="-2y", end_date="-1M").isoformat(),
        })
    return orgs


def gen_beneficiaries(orgs, n=25):
    beneficiaries = []
    for _ in range(n):
        org = random.choice(orgs)
        beneficiaries.append({
            "id": str(uuid.uuid4()),
            "organization_id": org["id"],
            "nickname": random.choice(NICKNAMES),
            "age": random.randint(1, 17),
            "gender": random.choice(["M", "F"]),
            "situation": random.choice(SITUATIONS),
            "health_note": random.choice([None, None, None, "Mild asthma", "Post-operative recovery",
                                           "Regular medical follow-up"]),
            "created_at": fake.date_time_between(start_date="-1y", end_date="-2w").isoformat(),
        })
    return beneficiaries


def gen_wishes(orgs, beneficiaries, n=40):
    wishes = []
    for _ in range(n):
        beneficiary = random.choice(beneficiaries)
        org = next(o for o in orgs if o["id"] == beneficiary["organization_id"])
        title, desc, category, cost_range, tags = random.choice(WISH_TEMPLATES)
        cost = round(random.uniform(*cost_range), 2)
        urgency = urgency_from_category(category)
        status = random.choices(
            ["open", "partially_funded", "funded", "delivered"],
            weights=[0.45, 0.25, 0.15, 0.15]
        )[0]
        raised = 0.0
        if status == "partially_funded":
            raised = round(cost * random.uniform(0.1, 0.7), 2)
        elif status in ("funded", "delivered"):
            raised = cost

        wishes.append({
            "id": str(uuid.uuid4()),
            "beneficiary_id": beneficiary["id"],
            "organization_id": org["id"],
            "category": category,
            "title": title,
            "description": desc,
            "story_context": fake.sentence(nb_words=18),
            "estimated_cost": cost,
            "amount_raised": raised,
            "currency": "MAD",
            "urgency": urgency,
            "status": status,
            "relay_point": org["relay_point"],
            "city": org["city"],
            "region": org["region"],
            "tags": tags,
            "deadline": (datetime.now() + timedelta(days=random.randint(5, 90))).date().isoformat()
                        if urgency in ("high", "critical") else None,
            "created_at": fake.date_time_between(start_date="-6M", end_date="now").isoformat(),
        })
    return wishes


def gen_donors(n=15):
    donors = []
    for _ in range(n):
        donors.append({
            "id": str(uuid.uuid4()),
            "full_name": fake.name(),
            "email": fake.unique.email(),
            "phone": clean_phone(),
            "preferred_categories": random.sample(CATEGORIES, k=random.randint(1, 3)),
            "total_donated": 0.0,  # recalculated below
            "created_at": fake.date_time_between(start_date="-1y", end_date="-1M").isoformat(),
        })
    return donors


def gen_donations(donors, wishes, n=35):
    donations = []
    donor_totals = {d["id"]: 0.0 for d in donors}
    fundable_wishes = [w for w in wishes if w["status"] in ("partially_funded", "funded", "delivered")]
    for _ in range(n):
        if not fundable_wishes:
            break
        wish = random.choice(fundable_wishes)
        donor = random.choice(donors)
        amount = round(random.uniform(20, wish["estimated_cost"] * 0.5), 2)
        donor_totals[donor["id"]] += amount
        donations.append({
            "id": str(uuid.uuid4()),
            "donor_id": donor["id"],
            "wish_id": wish["id"],
            "amount": amount,
            "donated_at": fake.date_time_between(start_date="-5M", end_date="now").isoformat(),
            "message": random.choice([None, "Wishing you all the best!", "With love.",
                                       "For your smile.", None]),
        })
    for d in donors:
        d["total_donated"] = round(donor_totals[d["id"]], 2)
    return donations


# Array columns that point to a custom ENUM -> need an explicit cast in SQL
ENUM_ARRAY_COLUMNS = {
    "preferred_categories": "wish_category[]",
}


def escape(val, col_name=None):
    if val is None:
        return "NULL"
    if isinstance(val, bool):
        return "TRUE" if val else "FALSE"
    if isinstance(val, (int, float)):
        return str(val)
    if isinstance(val, list):
        items = ",".join("'" + str(v).replace("'", "''") + "'" for v in val)
        array_literal = f"ARRAY[{items}]"
        if col_name in ENUM_ARRAY_COLUMNS:
            array_literal += f"::{ENUM_ARRAY_COLUMNS[col_name]}"
        return array_literal
    escaped = str(val).replace("'", "''")
    return f"'{escaped}'"


def to_sql_inserts(table, rows):
    if not rows:
        return ""
    cols = rows[0].keys()
    lines = [f"INSERT INTO {table} ({', '.join(cols)}) VALUES"]
    value_lines = []
    for row in rows:
        values = ", ".join(escape(row[c], col_name=c) for c in cols)
        value_lines.append(f"    ({values})")
    lines.append(",\n".join(value_lines) + ";\n")
    return "\n".join(lines)


def main():
    orgs = gen_organizations(n=8)
    beneficiaries = gen_beneficiaries(orgs, n=25)
    wishes = gen_wishes(orgs, beneficiaries, n=40)
    donors = gen_donors(n=15)
    donations = gen_donations(donors, wishes, n=35)

  
    with open("seed_data.json", "w", encoding="utf-8") as f:
        json.dump({
            "organizations": orgs,
            "beneficiaries": beneficiaries,
            "wishes": wishes,
            "donors": donors,
            "donations": donations,
        }, f, ensure_ascii=False, indent=2)

 
    wishes_for_sql = [{k: v for k, v in w.items() if k != "rag_text"} for w in wishes]

    with open("seed_data.sql", "w", encoding="utf-8") as f:
        f.write("-- GOLDEN WISHES — Generated fake data (Faker)\n")
        f.write("BEGIN;\n\n")
        f.write(to_sql_inserts("organizations", orgs) + "\n")
        f.write(to_sql_inserts("beneficiaries", beneficiaries) + "\n")
        f.write(to_sql_inserts("wishes", wishes_for_sql) + "\n")
        f.write(to_sql_inserts("donors", donors) + "\n")
        f.write(to_sql_inserts("donations", donations) + "\n")
        f.write("COMMIT;\n")

    print(f"Generated {len(orgs)} organizations")
    print(f"Generated {len(beneficiaries)} beneficiaries")
    print(f"Generated {len(wishes)} wishes")
    print(f"Generated {len(donors)} donors")
    print(f"Generated {len(donations)} donations")
    print("\nFiles created: seed_data.sql, seed_data.json")


if __name__ == "__main__":
    main()