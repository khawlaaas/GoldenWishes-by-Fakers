--
-- PostgreSQL database dump
--

\restrict Z4zW0jy9lOMlbYFjAsV9qnPc1XQPJPp4z34tS77UNc3x4BKrd7rjlE4u61eQXvG

-- Dumped from database version 16.15 (Ubuntu 16.15-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.15 (Ubuntu 16.15-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: beneficiary_situation; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.beneficiary_situation AS ENUM (
    'orphan',
    'family_in_difficulty',
    'chronic_illness',
    'hospitalization',
    'temporary_placement'
);


--
-- Name: org_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.org_type AS ENUM (
    'orphanage',
    'hospital',
    'ngo',
    'community_center',
    'legal_guardian'
);


--
-- Name: urgency_level; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.urgency_level AS ENUM (
    'low',
    'medium',
    'high',
    'critical'
);


--
-- Name: wish_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.wish_category AS ENUM (
    'education',
    'essentials',
    'creative',
    'family_care',
    'health',
    'clothing',
    'technology',
    'sport'
);


--
-- Name: wish_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.wish_status AS ENUM (
    'open',
    'partially_funded',
    'funded',
    'delivered',
    'expired'
);


--
-- Name: set_wish_rag_text(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_wish_rag_text() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.rag_text := NEW.title || '. ' || NEW.description ||
        ' Category: ' || NEW.category::text ||
        '. Urgency: ' || NEW.urgency::text ||
        '. Estimated cost: ' || NEW.estimated_cost || ' ' || NEW.currency ||
        '. Location: ' || NEW.city || ', ' || NEW.region || '.';
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(150) NOT NULL,
    org_type public.org_type NOT NULL,
    contact_name character varying(100) NOT NULL,
    contact_phone character varying(30) NOT NULL,
    contact_email character varying(150),
    city character varying(80) NOT NULL,
    region character varying(80) NOT NULL,
    relay_point character varying(150),
    is_verified boolean DEFAULT false NOT NULL,
    verification_doc_url character varying(255),
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: wishes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wishes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    beneficiary_id uuid,
    organization_id uuid NOT NULL,
    category public.wish_category NOT NULL,
    title character varying(150) NOT NULL,
    description text NOT NULL,
    story_context text,
    estimated_cost numeric(10,2) NOT NULL,
    amount_raised numeric(10,2) DEFAULT 0 NOT NULL,
    currency character varying(5) DEFAULT 'MAD'::character varying NOT NULL,
    urgency public.urgency_level DEFAULT 'medium'::public.urgency_level NOT NULL,
    status public.wish_status DEFAULT 'open'::public.wish_status NOT NULL,
    relay_point character varying(150) NOT NULL,
    city character varying(80) NOT NULL,
    region character varying(80) NOT NULL,
    tags text[],
    deadline date,
    rag_text text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: active_wishes_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.active_wishes_view AS
 SELECT w.id,
    w.title,
    w.description,
    w.category,
    w.urgency,
    w.status,
    w.estimated_cost,
    w.amount_raised,
    (w.estimated_cost - w.amount_raised) AS amount_remaining,
    w.currency,
    w.city,
    w.region,
    w.relay_point,
    w.tags,
    w.rag_text,
    o.name AS organization_name,
    o.is_verified AS organization_verified
   FROM (public.wishes w
     JOIN public.organizations o ON ((w.organization_id = o.id)))
  WHERE (w.status = ANY (ARRAY['open'::public.wish_status, 'partially_funded'::public.wish_status]));


--
-- Name: beneficiaries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.beneficiaries (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid NOT NULL,
    nickname character varying(50) NOT NULL,
    age smallint,
    gender character varying(10),
    situation public.beneficiary_situation NOT NULL,
    health_note text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT beneficiaries_age_check CHECK (((age >= 0) AND (age <= 18)))
);


--
-- Name: donations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.donations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    donor_id uuid NOT NULL,
    wish_id uuid NOT NULL,
    amount numeric(10,2) NOT NULL,
    donated_at timestamp without time zone DEFAULT now() NOT NULL,
    message text
);


--
-- Name: donors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.donors (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    full_name character varying(100) NOT NULL,
    email character varying(150) NOT NULL,
    phone character varying(30),
    preferred_categories public.wish_category[],
    total_donated numeric(10,2) DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Data for Name: beneficiaries; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.beneficiaries (id, organization_id, nickname, age, gender, situation, health_note, created_at) FROM stdin;
ce252bd5-e84d-4ed0-853e-e564bcb193f4	1531a2f9-00a2-4857-87b9-1c30d6bdce9f	Nour	3	M	family_in_difficulty	\N	2026-04-18 09:20:56.504476
79fc11f9-3918-41da-a7dc-d79ea65f130c	e8547f48-86d0-44d8-a11e-b2a99bdc229e	Yasmine	4	F	chronic_illness	Mild asthma	2026-05-16 01:03:13.232525
9af06568-a2d2-4179-bc6f-2fc44582f7e5	1531a2f9-00a2-4857-87b9-1c30d6bdce9f	Rayan	12	F	family_in_difficulty	Regular medical follow-up	2026-07-04 10:35:12.845701
8361615e-b967-41b0-abf4-f18bb4d47ec4	e5188eb7-abfc-4697-b18d-60c5884a4403	Salma	6	M	family_in_difficulty	Mild asthma	2026-01-30 15:29:05.056236
83a26837-6790-4c26-bf34-67114adea484	1783a76b-69f8-44e9-8612-f6e14491718c	Ilyas	8	F	orphan	\N	2026-01-16 03:31:02.547853
2c4afb98-bbc6-4916-9abc-d79ec3851a1f	0e3d2e3a-e60d-4fac-9d2a-16a3244b4f4e	Zayd	13	F	orphan	\N	2026-05-02 00:37:50.363233
f5fac058-4a8f-4ddb-aa3c-3a004265bbc1	1531a2f9-00a2-4857-87b9-1c30d6bdce9f	Nour	16	F	hospitalization	\N	2026-07-30 10:45:35.381333
c1677f46-f8c7-42ee-b106-dd254bc727ba	e5188eb7-abfc-4697-b18d-60c5884a4403	Lina	8	F	temporary_placement	Mild asthma	2026-07-05 09:42:58.918507
7d0f7e1e-2ddc-492a-9304-23a6afb2e041	1783a76b-69f8-44e9-8612-f6e14491718c	Malak	8	M	temporary_placement	Mild asthma	2026-01-15 01:24:43.117337
969b4c46-52c1-43a7-989d-7e368d7021d2	e8547f48-86d0-44d8-a11e-b2a99bdc229e	Youssef	4	M	family_in_difficulty	Regular medical follow-up	2026-05-20 02:02:57.966794
66c5461d-23be-40f3-a4f5-ce7557bf4960	1783a76b-69f8-44e9-8612-f6e14491718c	Salma	13	F	temporary_placement	Mild asthma	2026-04-16 14:56:05.35933
4e33b420-4504-43a5-8dd8-81695782d927	e5188eb7-abfc-4697-b18d-60c5884a4403	Amara	4	F	chronic_illness	\N	2025-11-20 23:52:21.845815
fdd383be-670c-4b13-a0fb-4586071c265f	e5188eb7-abfc-4697-b18d-60c5884a4403	Sara	6	F	orphan	Regular medical follow-up	2026-05-20 19:38:51.791
ef3c0f18-43df-4def-8773-ac23c00014d2	e5188eb7-abfc-4697-b18d-60c5884a4403	Rayan	17	M	chronic_illness	Regular medical follow-up	2025-12-03 09:47:22.990918
588ae410-f9a0-42b7-a157-e6848cd0e1d0	3c239bc1-e360-4a06-bec8-c0700145e38f	Lina	12	M	temporary_placement	Post-operative recovery	2025-11-07 00:43:57.499271
5b56fda1-4dfd-4741-bed6-776c1a5d6f15	0e3d2e3a-e60d-4fac-9d2a-16a3244b4f4e	Zayd	16	M	orphan	\N	2026-02-12 12:32:50.209704
b19822e2-8a67-41a9-b162-975b88eb3892	e5188eb7-abfc-4697-b18d-60c5884a4403	Yasmine	2	M	temporary_placement	\N	2026-03-24 17:43:09.082747
8c836a74-51e8-47c5-9773-9f2e3331cb91	e8547f48-86d0-44d8-a11e-b2a99bdc229e	Imane	3	M	family_in_difficulty	Regular medical follow-up	2026-08-28 19:39:50.789277
2d9fa752-9873-43c7-a75f-885579a8965f	72fe2390-b53f-4d64-a97a-89b146287aaf	Rayan	9	F	family_in_difficulty	Post-operative recovery	2025-12-14 16:18:40.381687
c2587f56-5c2d-4ae9-9ff8-eadc529cfb2a	3c239bc1-e360-4a06-bec8-c0700145e38f	Kenza	13	F	hospitalization	Post-operative recovery	2026-08-22 02:48:07.887012
b250b7f6-f26c-4358-9894-31d7012fbb6c	72fe2390-b53f-4d64-a97a-89b146287aaf	Adam	8	M	orphan	\N	2025-10-19 22:54:47.680484
401d541b-fdad-4aa7-9974-7a59092d4bc3	0e3d2e3a-e60d-4fac-9d2a-16a3244b4f4e	Yasmine	8	M	orphan	Regular medical follow-up	2026-07-01 10:43:43.223047
cb3d2c1c-802a-4b11-a0e3-7aad9ae80f6f	0e3d2e3a-e60d-4fac-9d2a-16a3244b4f4e	Yasmine	3	M	chronic_illness	\N	2025-11-17 04:14:56.383749
d7f71ac5-e0aa-40d5-807f-c1cd9baa6287	3c239bc1-e360-4a06-bec8-c0700145e38f	Ilyas	16	M	temporary_placement	\N	2026-09-02 10:30:42.482352
3a030f4e-3514-41e8-875d-2a2f36797aa9	72fe2390-b53f-4d64-a97a-89b146287aaf	Yasmine	16	F	family_in_difficulty	\N	2026-07-20 05:48:42.616583
\.


--
-- Data for Name: donations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.donations (id, donor_id, wish_id, amount, donated_at, message) FROM stdin;
03d72b3e-f970-42b5-9674-cc7e496c0a98	411f47fa-e94a-47ca-aa81-7a085dea24c2	bd19bdca-bb22-4062-960c-1445d2ea41e8	97.42	2026-07-05 20:53:33.841185	Wishing you all the best!
8ace9c18-631b-43df-840e-4114433ff5d4	6cfbf239-a57b-4bf7-a4e7-63de9cc738bd	866dabba-ff09-4c17-baf7-d0ed14975737	176.72	2026-06-20 05:00:41.625707	Wishing you all the best!
814a69e0-a24d-4288-b9ec-f89115efe6ea	411f47fa-e94a-47ca-aa81-7a085dea24c2	678ff448-005a-49a3-b375-3c8df62608eb	104.36	2026-04-28 21:42:18.131276	\N
1248547d-3b8e-434a-8453-18636f45b84b	94b0b369-fac6-48c0-a7bc-e332107b7c91	bd19bdca-bb22-4062-960c-1445d2ea41e8	41.62	2026-05-30 05:16:14.996863	\N
434717ff-4852-46d6-b2f5-d70e2ba703ed	eb865e0c-5994-483f-b2ce-1b855e54a63f	e08dd334-7987-4a5c-b7a1-b0383ea89fac	121.08	2026-06-14 23:46:14.444387	\N
1117e6e6-de5f-4174-81e0-babe91d511ed	cb30e568-2e91-42d6-9e34-677d6feb7533	e08dd334-7987-4a5c-b7a1-b0383ea89fac	165.32	2026-09-22 14:19:30.860086	\N
df73874f-e53e-4db8-9073-140fae6d7d56	7759eb6b-8954-420d-a99d-ca7301667f08	27fbb1eb-ca34-48f1-9dc3-7a480ab3579d	70.24	2026-08-08 01:24:05.872492	For your smile.
b75fbfde-8d24-4a93-ac11-6bea0ab73a5d	add3f4b3-d906-4bcf-9a33-0ee78bc54d62	11d14ff9-5309-47ec-8c1b-34bd4299d845	912.43	2026-07-20 09:14:53.553366	\N
95d21dcb-e935-485c-bff0-77e57f25c08c	411f47fa-e94a-47ca-aa81-7a085dea24c2	e08dd334-7987-4a5c-b7a1-b0383ea89fac	48.86	2026-05-09 23:17:48.124009	For your smile.
89a82aa6-6f59-4530-b2bb-c376fff297b7	e4b002a9-95cf-413c-9eb7-eb2e9c2ad461	e08dd334-7987-4a5c-b7a1-b0383ea89fac	156.32	2026-09-07 07:37:57.526169	With love.
446159c8-d338-4f1a-b952-db36b671662d	6cfbf239-a57b-4bf7-a4e7-63de9cc738bd	11d14ff9-5309-47ec-8c1b-34bd4299d845	693.43	2026-06-24 14:23:15.565542	With love.
ccb956c3-8c1b-414f-83e7-2065176061f0	5bd540e7-438a-4765-a271-cd67ae6e6fde	e08dd334-7987-4a5c-b7a1-b0383ea89fac	149.39	2026-06-30 00:07:28.940405	Wishing you all the best!
2bdd823e-adbb-4ce8-8b6d-75bbca38fc04	71f0dd26-3ebf-47a2-ad7f-43cb3e1c818c	4f085402-8a5d-4103-bd9b-2aadf5e075f1	84.22	2026-06-15 21:45:54.409404	\N
413baa3f-749a-4c73-a730-b5896b8bd69e	cb30e568-2e91-42d6-9e34-677d6feb7533	203ebd4a-f349-4e39-9e79-8e0524b03c50	29.03	2026-05-09 00:40:23.7674	For your smile.
f042fc55-1a68-4c4e-bec8-7a012174fa43	8c4a19cf-abac-4920-b147-749dea396eb0	33f4a12c-a7be-416f-a3a4-aadea4f0cfc8	182.32	2026-07-31 04:43:26.115122	For your smile.
592ed57c-aa0a-4af0-a810-98aefa155c1e	71f0dd26-3ebf-47a2-ad7f-43cb3e1c818c	bd19bdca-bb22-4062-960c-1445d2ea41e8	86.70	2026-05-23 01:46:12.387908	For your smile.
cae8c3ae-0b4d-43c9-bed6-48fdb6d32710	94b0b369-fac6-48c0-a7bc-e332107b7c91	ddeb7271-03e1-4c11-9097-8db6f965da80	54.27	2026-08-20 11:05:03.313553	For your smile.
8fd2dfff-99c1-42ac-beca-5228efe848f0	fff8d0b2-05a7-4527-a907-1a233826b1e9	678ff448-005a-49a3-b375-3c8df62608eb	118.92	2026-06-06 22:04:17.595333	\N
95aa1cf6-e76e-4cf2-bdc9-a58b96404a47	6cfbf239-a57b-4bf7-a4e7-63de9cc738bd	866dabba-ff09-4c17-baf7-d0ed14975737	22.31	2026-07-21 07:07:39.436653	With love.
a79b18b9-7177-4755-928f-864da168f8fc	2895f560-8fad-4303-a507-436adc08e43f	351eb4c5-2e3d-4def-9082-5e4ee9e853e3	90.81	2026-06-07 12:30:59.979	For your smile.
e7bc49c4-22fb-4a61-b265-3453559cb02f	8c4a19cf-abac-4920-b147-749dea396eb0	27fbb1eb-ca34-48f1-9dc3-7a480ab3579d	136.31	2026-08-14 08:00:43.287024	\N
bf2cf928-e9ca-418e-b4ba-03e699c1b8ad	6cfbf239-a57b-4bf7-a4e7-63de9cc738bd	d3aa4316-3f88-4d55-90e6-c3bd905bec29	54.61	2026-08-10 01:33:09.377386	For your smile.
77d5a6ed-a7c1-4be1-bc9a-8806237a075c	eb865e0c-5994-483f-b2ce-1b855e54a63f	d530b865-d09b-40d2-a3a8-45a703b02998	49.51	2026-06-06 11:50:14.49164	For your smile.
e88e5279-0b23-4d14-aa2e-1251c34c93c9	fff8d0b2-05a7-4527-a907-1a233826b1e9	40c59527-e1e3-4e29-9c1e-23702045f785	67.91	2026-08-17 10:51:39.373016	Wishing you all the best!
de90d0e7-5a8e-4818-9ce6-a714bf03a975	eb865e0c-5994-483f-b2ce-1b855e54a63f	27fbb1eb-ca34-48f1-9dc3-7a480ab3579d	163.59	2026-05-04 09:51:58.98941	\N
63400cee-2497-4e61-9932-d867bdc1a1b1	5bd540e7-438a-4765-a271-cd67ae6e6fde	678ff448-005a-49a3-b375-3c8df62608eb	92.20	2026-07-07 23:21:00.027338	Wishing you all the best!
a734120f-f0dc-4943-87de-33027b270081	cb30e568-2e91-42d6-9e34-677d6feb7533	e08dd334-7987-4a5c-b7a1-b0383ea89fac	29.12	2026-07-23 00:48:53.961864	For your smile.
bbc9dbae-c91c-4390-997d-c52af63bcd77	94b0b369-fac6-48c0-a7bc-e332107b7c91	65934663-cbff-42af-84ea-88ac0d43ea79	45.23	2026-05-18 22:56:52.305807	With love.
24a7da6f-621e-4bf1-8318-f7450e67f69b	e4b002a9-95cf-413c-9eb7-eb2e9c2ad461	866dabba-ff09-4c17-baf7-d0ed14975737	314.90	2026-07-09 18:26:51.37537	For your smile.
217cebc3-fd1b-46c9-a051-d1bf6cc105c9	fff8d0b2-05a7-4527-a907-1a233826b1e9	4f085402-8a5d-4103-bd9b-2aadf5e075f1	36.45	2026-08-29 10:14:26.36743	\N
9cd0f67f-ffb4-430d-ba70-6dafe35489cd	eb865e0c-5994-483f-b2ce-1b855e54a63f	27fbb1eb-ca34-48f1-9dc3-7a480ab3579d	178.32	2026-07-12 14:10:50.488306	With love.
615b064f-ecbc-4ca6-91e0-17df44700317	69f440e1-b3c4-4a8f-8601-d1997352f48e	d3aa4316-3f88-4d55-90e6-c3bd905bec29	30.82	2026-09-23 14:21:45.528512	\N
28b6def5-476b-40d6-b845-d24e197ec0fc	94b0b369-fac6-48c0-a7bc-e332107b7c91	678ff448-005a-49a3-b375-3c8df62608eb	42.39	2026-05-12 07:36:04.830483	\N
2f7a5a8e-1400-4e9f-8600-76494464afcf	94b0b369-fac6-48c0-a7bc-e332107b7c91	33f4a12c-a7be-416f-a3a4-aadea4f0cfc8	115.76	2026-05-29 15:00:07.351081	\N
77af8267-da43-4bcd-9160-98753ea34a7a	6cfbf239-a57b-4bf7-a4e7-63de9cc738bd	eafa2d07-6ce2-4c7e-8a83-f2ef4f903844	91.99	2026-05-08 10:13:47.57671	With love.
\.


--
-- Data for Name: donors; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.donors (id, full_name, email, phone, preferred_categories, total_donated, created_at) FROM stdin;
eb865e0c-5994-483f-b2ce-1b855e54a63f	Emily Rowe	davidlewis@example.org	+212 636445607	{technology,education}	512.50	2026-03-19 03:23:13.319503
5bd540e7-438a-4765-a271-cd67ae6e6fde	Jessica Lowe	manuel74@example.net	+212 699152472	{clothing,sport}	241.59	2025-11-17 02:55:54.484805
cb30e568-2e91-42d6-9e34-677d6feb7533	Sylvia Gonzalez	shane16@example.org	+212 626726926	{health,sport,creative}	223.47	2026-02-15 00:33:23.253594
94b0b369-fac6-48c0-a7bc-e332107b7c91	Shaun Martinez	gregorynorris@example.org	+212 699508850	{clothing,family_care}	299.27	2025-10-17 13:08:49.066096
e4b002a9-95cf-413c-9eb7-eb2e9c2ad461	Jeffery Adams	timothy42@example.org	+212 649682169	{creative,essentials,family_care}	471.22	2026-01-13 22:06:46.023551
71f0dd26-3ebf-47a2-ad7f-43cb3e1c818c	David Jones	davismisty@example.org	+212 699245317	{creative,health}	170.92	2026-02-28 18:33:45.601596
add3f4b3-d906-4bcf-9a33-0ee78bc54d62	Jennifer Coleman	bakercynthia@example.net	+212 686384014	{technology,health}	912.43	2026-05-04 07:44:37.960474
6cfbf239-a57b-4bf7-a4e7-63de9cc738bd	Devin Proctor	wramirez@example.net	+212 610054484	{health,essentials}	1039.06	2025-11-21 07:15:24.372107
7a5e3227-70a9-415b-b992-229e9e7a1c52	Allison Rhodes	trichards@example.org	+212 667698610	{clothing,family_care,technology}	0.00	2026-04-07 01:13:11.457348
7759eb6b-8954-420d-a99d-ca7301667f08	Carlos Payne	gkoch@example.net	+212 669345683	{family_care,health,sport}	70.24	2025-09-29 02:46:29.654039
69f440e1-b3c4-4a8f-8601-d1997352f48e	Matthew Oneal	ashley54@example.net	+212 632775593	{essentials,creative,health}	30.82	2026-02-05 00:50:29.31491
8c4a19cf-abac-4920-b147-749dea396eb0	Jeremy Lawrence	aaron79@example.net	+212 699100953	{clothing,education,essentials}	318.63	2026-07-13 18:45:59.090998
2895f560-8fad-4303-a507-436adc08e43f	Jeffrey Lynch	jennifer00@example.com	+212 651663795	{family_care}	90.81	2026-04-26 03:15:07.995904
fff8d0b2-05a7-4527-a907-1a233826b1e9	Alexandria Nelson	martinezjames@example.com	+212 629777514	{education}	223.28	2026-06-10 02:16:10.128644
411f47fa-e94a-47ca-aa81-7a085dea24c2	Margaret Dalton	benjamin80@example.org	+212 642862209	{essentials,family_care}	250.64	2026-02-24 07:09:21.885875
\.


--
-- Data for Name: organizations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.organizations (id, name, org_type, contact_name, contact_phone, contact_email, city, region, relay_point, is_verified, verification_doc_url, created_at) FROM stdin;
0e3d2e3a-e60d-4fac-9d2a-16a3244b4f4e	Agadir Association for Children	orphanage	Bruce Lewis	+212 642868828	dgreen@nguyen-house.com	Agadir	Souss-Massa	Relay point — Agadir City Hall	t	https://verify.goldenwishes.org/docs/d1d06045-aca3-4881-8b1e-9a858d21b45f	2025-04-05 17:22:34.466235
e8547f48-86d0-44d8-a11e-b2a99bdc229e	Karama NGO for Children Agadir	orphanage	Amanda Smith	+212 689254563	jenningsjeremiah@johnson.com	Agadir	Souss-Massa	Relay point — ENSAM Agadir	t	https://verify.goldenwishes.org/docs/593bbbad-daa3-4856-9676-ecaf7afaf188	2026-03-10 23:47:23.034852
dacfa3fa-8f05-4121-8059-5a1ebffe6962	Al Amal Orphanage - Casablanca	orphanage	William Barnett	+212 677827638	elizabethjones@gilmore.com	Casablanca	Casablanca-Settat	Relay point — Faculty of Sciences Casablanca	t	https://verify.goldenwishes.org/docs/37dea800-0fdc-48d2-aed2-c39bd97c2c6c	2025-11-01 05:04:50.577525
3c239bc1-e360-4a06-bec8-c0700145e38f	Karama NGO for Children Tangier	hospital	Jennifer Jordan	+212 639587039	marcusmcpherson@weber-phillips.org	Tangier	Tanger-Tetouan-Al Hoceima	Relay point — Tangier Public Library	t	https://verify.goldenwishes.org/docs/be0d5aae-b0dd-4497-9b64-68b76b3d5314	2025-10-04 04:38:33.775222
e5188eb7-abfc-4697-b18d-60c5884a4403	Al Amal Orphanage - Marrakech	orphanage	Makayla Carter	+212 655667651	quinnerica@mckenzie.com	Marrakech	Marrakech-Safi	Relay point — Marrakech Public Library	t	https://verify.goldenwishes.org/docs/73e39e36-4446-47fa-b1b4-3c0d9ba1e9f6	2024-12-18 16:59:16.043319
1531a2f9-00a2-4857-87b9-1c30d6bdce9f	Rabat Association for Children	ngo	Amanda Hall	+212 660992979	xdominguez@simmons.com	Rabat	Rabat-Sale-Kenitra	Relay point — ENSAM Rabat	t	https://verify.goldenwishes.org/docs/d686dd31-51b6-4de6-b903-7d6df0fa0c7f	2025-12-30 10:16:34.075549
1783a76b-69f8-44e9-8612-f6e14491718c	Hope Foundation Oujda	ngo	Bianca Simpson	+212 615831819	cynthiamatthews@ferguson.com	Oujda	L'Oriental	Relay point — Oujda City Hall	t	https://verify.goldenwishes.org/docs/b6adc7cf-a6ff-48b1-bd2f-478255341fd0	2026-02-27 01:26:48.50949
72fe2390-b53f-4d64-a97a-89b146287aaf	Ennour Community Center Tangier	orphanage	Brandy Campbell	+212 684093639	tara42@solomon.com	Tangier	Tanger-Tetouan-Al Hoceima	Relay point — ENSAM Tangier	t	https://verify.goldenwishes.org/docs/047bcdda-6da3-4012-8e5e-bd632d90489a	2026-05-11 06:48:41.047084
\.


--
-- Data for Name: wishes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.wishes (id, beneficiary_id, organization_id, category, title, description, story_context, estimated_cost, amount_raised, currency, urgency, status, relay_point, city, region, tags, deadline, rag_text, created_at, updated_at) FROM stdin;
678ff448-005a-49a3-b375-3c8df62608eb	8361615e-b967-41b0-abf4-f18bb4d47ec4	e5188eb7-abfc-4697-b18d-60c5884a4403	sport	A ball and a pair of football boots	For the kid who dreams of joining the neighborhood team.	Like top serve fact middle argue people poor position religious phone him practice player floor most day.	264.66	142.24	MAD	medium	partially_funded	Relay point — Marrakech Public Library	Marrakech	Marrakech-Safi	{sport,hobby}	\N	A ball and a pair of football boots. For the kid who dreams of joining the neighborhood team. Category: sport. Urgency: medium. Estimated cost: 264.66 MAD. Location: Marrakech, Marrakech-Safi.	2026-07-19 14:38:44.023038	2026-09-27 10:56:35.664264
b7c927c9-9c33-43ca-98be-4df44cfde63e	401d541b-fdad-4aa7-9974-7a59092d4bc3	0e3d2e3a-e60d-4fac-9d2a-16a3244b4f4e	sport	A ball and a pair of football boots	For the kid who dreams of joining the neighborhood team.	So yourself draw commercial manage environment most attention data protect ahead everyone beautiful finish fight rather not item campaign start hand begin.	347.62	0.00	MAD	low	open	Relay point — Agadir City Hall	Agadir	Souss-Massa	{sport,hobby}	\N	A ball and a pair of football boots. For the kid who dreams of joining the neighborhood team. Category: sport. Urgency: low. Estimated cost: 347.62 MAD. Location: Agadir, Souss-Massa.	2026-04-25 14:42:19.855657	2026-09-27 10:56:35.664264
4155fe26-d8ad-42db-86c2-cfe9b305a344	66c5461d-23be-40f3-a4f5-ce7557bf4960	1783a76b-69f8-44e9-8612-f6e14491718c	essentials	A wool blanket for winter	Thick enough for a cold night without heating.	Memory process director former to current environment fund deal each order project purpose new career thus gun spring five stock have vote kitchen certain.	167.41	0.00	MAD	low	open	Relay point — Oujda City Hall	Oujda	L'Oriental	{winter,comfort,urgent}	\N	A wool blanket for winter. Thick enough for a cold night without heating. Category: essentials. Urgency: low. Estimated cost: 167.41 MAD. Location: Oujda, L'Oriental.	2026-07-26 15:46:42.427046	2026-09-27 10:56:35.664264
ddeb7271-03e1-4c11-9097-8db6f965da80	ef3c0f18-43df-4def-8773-ac23c00014d2	e5188eb7-abfc-4697-b18d-60c5884a4403	creative	A drawing set for a child who draws every day	Colored pencils, a sketchpad, and a box of paints.	Learn specific yes rather national generation seven air because alone send save loss difference house really act fine.	122.28	122.28	MAD	low	delivered	Relay point — Marrakech Public Library	Marrakech	Marrakech-Safi	{creativity,hobby}	\N	A drawing set for a child who draws every day. Colored pencils, a sketchpad, and a box of paints. Category: creative. Urgency: low. Estimated cost: 122.28 MAD. Location: Marrakech, Marrakech-Safi.	2026-08-28 07:43:06.858682	2026-09-27 10:56:35.664264
203ebd4a-f349-4e39-9e79-8e0524b03c50	588ae410-f9a0-42b7-a157-e6848cd0e1d0	3c239bc1-e360-4a06-bec8-c0700145e38f	clothing	A winter coat that fits	Hers is torn and outgrown from last year.	Ground foreign benefit property these few true suddenly gas force strong spring.	159.79	17.39	MAD	high	partially_funded	Relay point — Tangier Public Library	Tangier	Tanger-Tetouan-Al Hoceima	{winter,clothing}	2026-10-13	A winter coat that fits. Hers is torn and outgrown from last year. Category: clothing. Urgency: high. Estimated cost: 159.79 MAD. Location: Tangier, Tanger-Tetouan-Al Hoceima.	2026-08-02 09:07:44.229161	2026-09-27 10:56:35.664264
d7d9ef36-b121-4313-bf79-83288a1fb203	3a030f4e-3514-41e8-875d-2a2f36797aa9	72fe2390-b53f-4d64-a97a-89b146287aaf	family_care	Three months of infant formula	One tin a month, for a baby whose family is between jobs.	Health region test group for the friend what be feeling third.	324.95	0.00	MAD	medium	open	Relay point — ENSAM Tangier	Tangier	Tanger-Tetouan-Al Hoceima	{baby,nutrition,urgent}	\N	Three months of infant formula. One tin a month, for a baby whose family is between jobs. Category: family_care. Urgency: medium. Estimated cost: 324.95 MAD. Location: Tangier, Tanger-Tetouan-Al Hoceima.	2026-07-31 02:52:57.838553	2026-09-27 10:56:35.664264
d34313a8-996f-4c30-a5af-a4f58a4e186e	fdd383be-670c-4b13-a0fb-4586071c265f	e5188eb7-abfc-4697-b18d-60c5884a4403	education	A school bag, fully stocked	Notebooks, pens, a compass set, and a bag sturdy enough to last the whole year.	Meeting movement meeting successful apply across eight fast class opportunity form throughout top eat recent water hit one less feel anyone dog each just.	216.46	0.00	MAD	low	open	Relay point — Marrakech Public Library	Marrakech	Marrakech-Safi	{school,supplies,back-to-school}	\N	A school bag, fully stocked. Notebooks, pens, a compass set, and a bag sturdy enough to last the whole year. Category: education. Urgency: low. Estimated cost: 216.46 MAD. Location: Marrakech, Marrakech-Safi.	2026-07-17 17:20:20.487336	2026-09-27 10:56:35.664264
642668ef-0a30-43d2-8ed6-21e867c1a2cf	588ae410-f9a0-42b7-a157-e6848cd0e1d0	3c239bc1-e360-4a06-bec8-c0700145e38f	education	A full set of school books	This year's required textbooks, bought new so nothing is missing.	Word simply key less join worry arrive mean half outside from garden bag include base five various continue hope main.	413.45	413.45	MAD	critical	delivered	Relay point — Tangier Public Library	Tangier	Tanger-Tetouan-Al Hoceima	{school,textbooks}	2026-12-12	A full set of school books. This year's required textbooks, bought new so nothing is missing. Category: education. Urgency: critical. Estimated cost: 413.45 MAD. Location: Tangier, Tanger-Tetouan-Al Hoceima.	2026-05-04 01:20:35.430382	2026-09-27 10:56:35.664264
6a678fbd-837d-47c0-8123-2171e595e97e	401d541b-fdad-4aa7-9974-7a59092d4bc3	0e3d2e3a-e60d-4fac-9d2a-16a3244b4f4e	health	A month of chronic illness medication	Essential medication to cover one month of treatment.	Individual central safe gun all impact up officer goal relate often her agency.	694.67	0.00	MAD	high	open	Relay point — Agadir City Hall	Agadir	Souss-Massa	{health,critical,medical}	2026-10-09	A month of chronic illness medication. Essential medication to cover one month of treatment. Category: health. Urgency: high. Estimated cost: 694.67 MAD. Location: Agadir, Souss-Massa.	2026-05-03 16:38:30.862532	2026-09-27 10:56:35.664264
9128c9d0-208a-45cf-88c6-8ca4f78d5967	2d9fa752-9873-43c7-a75f-885579a8965f	72fe2390-b53f-4d64-a97a-89b146287aaf	health	A month of chronic illness medication	Essential medication to cover one month of treatment.	Capital main community tax sit court actually feel dog need majority recognize cause tree company half man front.	716.88	0.00	MAD	critical	open	Relay point — ENSAM Tangier	Tangier	Tanger-Tetouan-Al Hoceima	{health,critical,medical}	2026-12-15	A month of chronic illness medication. Essential medication to cover one month of treatment. Category: health. Urgency: critical. Estimated cost: 716.88 MAD. Location: Tangier, Tanger-Tetouan-Al Hoceima.	2026-08-15 04:38:50.951601	2026-09-27 10:56:35.664264
70d74b07-9e58-4fd1-bf80-204818d54132	5b56fda1-4dfd-4741-bed6-776c1a5d6f15	0e3d2e3a-e60d-4fac-9d2a-16a3244b4f4e	clothing	A winter coat that fits	Hers is torn and outgrown from last year.	Give approach deal growth child image wall name best southern field finish.	241.94	0.00	MAD	medium	open	Relay point — Agadir City Hall	Agadir	Souss-Massa	{winter,clothing}	\N	A winter coat that fits. Hers is torn and outgrown from last year. Category: clothing. Urgency: medium. Estimated cost: 241.94 MAD. Location: Agadir, Souss-Massa.	2026-06-03 17:46:58.444767	2026-09-27 10:56:35.664264
0ccd4fda-bc99-47e8-9cc2-35f1f7f49004	b19822e2-8a67-41a9-b162-975b88eb3892	e5188eb7-abfc-4697-b18d-60c5884a4403	essentials	A wool blanket for winter	Thick enough for a cold night without heating.	Many room explain hot culture family small hit others daughter his beyond indeed push executive should effect event feeling agency.	209.59	0.00	MAD	low	open	Relay point — Marrakech Public Library	Marrakech	Marrakech-Safi	{winter,comfort,urgent}	\N	A wool blanket for winter. Thick enough for a cold night without heating. Category: essentials. Urgency: low. Estimated cost: 209.59 MAD. Location: Marrakech, Marrakech-Safi.	2026-07-31 02:07:26.717605	2026-09-27 10:56:35.664264
7d5f8433-a2f0-4c68-86e3-d98debf90ca4	c1677f46-f8c7-42ee-b106-dd254bc727ba	e5188eb7-abfc-4697-b18d-60c5884a4403	health	A course of physical therapy	Ten rehabilitation sessions needed after a surgery.	Along yet sister deal study area friend shoulder every fine make wife speech whatever piece picture show need play up.	847.95	0.00	MAD	critical	open	Relay point — Marrakech Public Library	Marrakech	Marrakech-Safi	{health,medical,critical}	2026-12-17	A course of physical therapy. Ten rehabilitation sessions needed after a surgery. Category: health. Urgency: critical. Estimated cost: 847.95 MAD. Location: Marrakech, Marrakech-Safi.	2026-08-16 15:59:39.162117	2026-09-27 10:56:35.664264
33f4a12c-a7be-416f-a3a4-aadea4f0cfc8	79fc11f9-3918-41da-a7dc-d79ea65f130c	e8547f48-86d0-44d8-a11e-b2a99bdc229e	technology	A tablet for remote classes	Also used by the shelter for evening tutoring sessions.	Food hear project whatever nothing perhaps room it agency police attorney small work see.	1557.39	451.37	MAD	high	partially_funded	Relay point — ENSAM Agadir	Agadir	Souss-Massa	{education,technology}	2026-11-04	A tablet for remote classes. Also used by the shelter for evening tutoring sessions. Category: technology. Urgency: high. Estimated cost: 1557.39 MAD. Location: Agadir, Souss-Massa.	2026-09-16 10:37:52.797148	2026-09-27 10:56:35.664264
a6743709-0996-4a30-b9f4-65e4e92378a3	f5fac058-4a8f-4ddb-aa3c-3a004265bbc1	1531a2f9-00a2-4857-87b9-1c30d6bdce9f	sport	A ball and a pair of football boots	For the kid who dreams of joining the neighborhood team.	Around recent long at pretty money business control beyond bag general deep everything staff baby say.	307.43	0.00	MAD	low	open	Relay point — ENSAM Rabat	Rabat	Rabat-Sale-Kenitra	{sport,hobby}	\N	A ball and a pair of football boots. For the kid who dreams of joining the neighborhood team. Category: sport. Urgency: low. Estimated cost: 307.43 MAD. Location: Rabat, Rabat-Sale-Kenitra.	2026-08-18 17:21:47.263068	2026-09-27 10:56:35.664264
40c59527-e1e3-4e29-9c1e-23702045f785	401d541b-fdad-4aa7-9974-7a59092d4bc3	0e3d2e3a-e60d-4fac-9d2a-16a3244b4f4e	sport	A ball and a pair of football boots	For the kid who dreams of joining the neighborhood team.	Too wife rule treatment coach wall ball simple eight believe although end physical class ball south share table interest.	245.00	245.00	MAD	medium	funded	Relay point — Agadir City Hall	Agadir	Souss-Massa	{sport,hobby}	\N	A ball and a pair of football boots. For the kid who dreams of joining the neighborhood team. Category: sport. Urgency: medium. Estimated cost: 245.00 MAD. Location: Agadir, Souss-Massa.	2026-08-31 23:52:30.539702	2026-09-27 10:56:35.664264
eafa2d07-6ce2-4c7e-8a83-f2ef4f903844	9af06568-a2d2-4179-bc6f-2fc44582f7e5	1531a2f9-00a2-4857-87b9-1c30d6bdce9f	education	A school bag, fully stocked	Notebooks, pens, a compass set, and a bag sturdy enough to last the whole year.	Themselves whatever cover Mrs wait appear the wall prevent deal writer young air near seat can second knowledge responsibility already race.	245.83	245.83	MAD	critical	delivered	Relay point — ENSAM Rabat	Rabat	Rabat-Sale-Kenitra	{school,supplies,back-to-school}	2026-10-11	A school bag, fully stocked. Notebooks, pens, a compass set, and a bag sturdy enough to last the whole year. Category: education. Urgency: critical. Estimated cost: 245.83 MAD. Location: Rabat, Rabat-Sale-Kenitra.	2026-08-19 18:15:34.74988	2026-09-27 10:56:35.664264
e670a3fd-18fd-450e-a09d-fc7607b2c9bd	8c836a74-51e8-47c5-9773-9f2e3331cb91	e8547f48-86d0-44d8-a11e-b2a99bdc229e	family_care	Three months of infant formula	One tin a month, for a baby whose family is between jobs.	Sign they five her edge fast herself unit forward protect police modern whether action floor executive music source itself international all.	375.88	0.00	MAD	low	open	Relay point — ENSAM Agadir	Agadir	Souss-Massa	{baby,nutrition,urgent}	\N	Three months of infant formula. One tin a month, for a baby whose family is between jobs. Category: family_care. Urgency: low. Estimated cost: 375.88 MAD. Location: Agadir, Souss-Massa.	2026-08-10 06:48:45.572029	2026-09-27 10:56:35.664264
d3aa4316-3f88-4d55-90e6-c3bd905bec29	9af06568-a2d2-4179-bc6f-2fc44582f7e5	1531a2f9-00a2-4857-87b9-1c30d6bdce9f	family_care	Three months of infant formula	One tin a month, for a baby whose family is between jobs.	Claim century offer include wife room rate stop stage common reduce woman majority style station dark.	355.43	355.43	MAD	low	funded	Relay point — ENSAM Rabat	Rabat	Rabat-Sale-Kenitra	{baby,nutrition,urgent}	\N	Three months of infant formula. One tin a month, for a baby whose family is between jobs. Category: family_care. Urgency: low. Estimated cost: 355.43 MAD. Location: Rabat, Rabat-Sale-Kenitra.	2026-05-19 17:04:59.502912	2026-09-27 10:56:35.664264
4f085402-8a5d-4103-bd9b-2aadf5e075f1	cb3d2c1c-802a-4b11-a0e3-7aad9ae80f6f	0e3d2e3a-e60d-4fac-9d2a-16a3244b4f4e	education	A full set of school books	This year's required textbooks, bought new so nothing is missing.	Opportunity Mrs assume hear money but edge power skin happen feel stay stage either health skin same foot.	441.75	46.25	MAD	critical	partially_funded	Relay point — Agadir City Hall	Agadir	Souss-Massa	{school,textbooks}	2026-12-11	A full set of school books. This year's required textbooks, bought new so nothing is missing. Category: education. Urgency: critical. Estimated cost: 441.75 MAD. Location: Agadir, Souss-Massa.	2026-06-05 03:23:47.439427	2026-09-27 10:56:35.664264
21690820-6d98-4eeb-9997-804af99857cb	969b4c46-52c1-43a7-989d-7e368d7021d2	e8547f48-86d0-44d8-a11e-b2a99bdc229e	sport	A ball and a pair of football boots	For the kid who dreams of joining the neighborhood team.	Million matter leader nice may three always ahead hit along blue small challenge account coach lose write nor.	215.54	0.00	MAD	high	open	Relay point — ENSAM Agadir	Agadir	Souss-Massa	{sport,hobby}	2026-10-15	A ball and a pair of football boots. For the kid who dreams of joining the neighborhood team. Category: sport. Urgency: high. Estimated cost: 215.54 MAD. Location: Agadir, Souss-Massa.	2026-05-19 10:26:36.188221	2026-09-27 10:56:35.664264
a8adb2e2-bd28-4aa6-a6ad-4fab17023667	d7f71ac5-e0aa-40d5-807f-c1cd9baa6287	3c239bc1-e360-4a06-bec8-c0700145e38f	clothing	A winter coat that fits	Hers is torn and outgrown from last year.	Several class purpose daughter note action daughter home suddenly candidate whatever such service leg federal.	165.54	0.00	MAD	low	open	Relay point — Tangier Public Library	Tangier	Tanger-Tetouan-Al Hoceima	{winter,clothing}	\N	A winter coat that fits. Hers is torn and outgrown from last year. Category: clothing. Urgency: low. Estimated cost: 165.54 MAD. Location: Tangier, Tanger-Tetouan-Al Hoceima.	2026-09-18 01:45:48.066717	2026-09-27 10:56:35.664264
351eb4c5-2e3d-4def-9082-5e4ee9e853e3	66c5461d-23be-40f3-a4f5-ce7557bf4960	1783a76b-69f8-44e9-8612-f6e14491718c	family_care	Three months of infant formula	One tin a month, for a baby whose family is between jobs.	Tough foreign far develop trade whatever fine discuss interest ten quality direction responsibility instead indicate behavior rather computer another wonder key.	403.12	101.05	MAD	high	partially_funded	Relay point — Oujda City Hall	Oujda	L'Oriental	{baby,nutrition,urgent}	2026-10-08	Three months of infant formula. One tin a month, for a baby whose family is between jobs. Category: family_care. Urgency: high. Estimated cost: 403.12 MAD. Location: Oujda, L'Oriental.	2026-08-11 07:32:22.087924	2026-09-27 10:56:35.664264
f011c8a2-86bf-43b4-9d43-11bc871d433e	9af06568-a2d2-4179-bc6f-2fc44582f7e5	1531a2f9-00a2-4857-87b9-1c30d6bdce9f	sport	A ball and a pair of football boots	For the kid who dreams of joining the neighborhood team.	Especially say condition day exactly study big ball authority man half hotel.	263.54	0.00	MAD	low	open	Relay point — ENSAM Rabat	Rabat	Rabat-Sale-Kenitra	{sport,hobby}	\N	A ball and a pair of football boots. For the kid who dreams of joining the neighborhood team. Category: sport. Urgency: low. Estimated cost: 263.54 MAD. Location: Rabat, Rabat-Sale-Kenitra.	2026-05-29 13:18:22.936321	2026-09-27 10:56:35.664264
65934663-cbff-42af-84ea-88ac0d43ea79	3a030f4e-3514-41e8-875d-2a2f36797aa9	72fe2390-b53f-4d64-a97a-89b146287aaf	creative	A drawing set for a child who draws every day	Colored pencils, a sketchpad, and a box of paints.	Eat give expect difficult true able whole hit color form might.	150.97	150.97	MAD	low	funded	Relay point — ENSAM Tangier	Tangier	Tanger-Tetouan-Al Hoceima	{creativity,hobby}	\N	A drawing set for a child who draws every day. Colored pencils, a sketchpad, and a box of paints. Category: creative. Urgency: low. Estimated cost: 150.97 MAD. Location: Tangier, Tanger-Tetouan-Al Hoceima.	2026-08-08 08:08:59.115982	2026-09-27 10:56:35.664264
9cbeb42d-e8e3-4428-8e64-821641debda8	8c836a74-51e8-47c5-9773-9f2e3331cb91	e8547f48-86d0-44d8-a11e-b2a99bdc229e	health	A month of chronic illness medication	Essential medication to cover one month of treatment.	Note theory five understand something economy race within resource actually writer send real rate discover production rather kind past hold very letter.	671.07	0.00	MAD	high	open	Relay point — ENSAM Agadir	Agadir	Souss-Massa	{health,critical,medical}	2026-10-21	A month of chronic illness medication. Essential medication to cover one month of treatment. Category: health. Urgency: high. Estimated cost: 671.07 MAD. Location: Agadir, Souss-Massa.	2026-09-04 05:08:53.971504	2026-09-27 10:56:35.664264
1f6af6da-7838-4307-87a8-95fa942a9252	8c836a74-51e8-47c5-9773-9f2e3331cb91	e8547f48-86d0-44d8-a11e-b2a99bdc229e	education	A school bag, fully stocked	Notebooks, pens, a compass set, and a bag sturdy enough to last the whole year.	Blue myself building sing least force minute water news almost other statement suggest today he on food myself dark cover happy street president.	283.46	0.00	MAD	medium	open	Relay point — ENSAM Agadir	Agadir	Souss-Massa	{school,supplies,back-to-school}	\N	A school bag, fully stocked. Notebooks, pens, a compass set, and a bag sturdy enough to last the whole year. Category: education. Urgency: medium. Estimated cost: 283.46 MAD. Location: Agadir, Souss-Massa.	2026-09-26 14:34:33.851071	2026-09-27 10:56:35.664264
f8f4d512-7bd1-4e4f-9abc-2809f428931b	83a26837-6790-4c26-bf34-67114adea484	1783a76b-69f8-44e9-8612-f6e14491718c	education	A school bag, fully stocked	Notebooks, pens, a compass set, and a bag sturdy enough to last the whole year.	During key she pass go life side develop theory fish run somebody either apply consider half ask growth they cover skill professor before high.	230.83	230.83	MAD	high	funded	Relay point — Oujda City Hall	Oujda	L'Oriental	{school,supplies,back-to-school}	2026-10-07	A school bag, fully stocked. Notebooks, pens, a compass set, and a bag sturdy enough to last the whole year. Category: education. Urgency: high. Estimated cost: 230.83 MAD. Location: Oujda, L'Oriental.	2026-08-06 15:28:51.020926	2026-09-27 10:56:35.664264
7ad8f096-c6e6-48cf-b89e-36a5e1b0d906	4e33b420-4504-43a5-8dd8-81695782d927	e5188eb7-abfc-4697-b18d-60c5884a4403	family_care	Three months of infant formula	One tin a month, for a baby whose family is between jobs.	Purpose wonder degree computer these bar a big career foreign response security forward pick trip game medical plan member though person.	402.31	0.00	MAD	high	open	Relay point — Marrakech Public Library	Marrakech	Marrakech-Safi	{baby,nutrition,urgent}	2026-12-12	Three months of infant formula. One tin a month, for a baby whose family is between jobs. Category: family_care. Urgency: high. Estimated cost: 402.31 MAD. Location: Marrakech, Marrakech-Safi.	2026-08-31 09:17:08.941784	2026-09-27 10:56:35.664264
bac9d3b7-45f1-43fe-bb9b-d369074c410f	ef3c0f18-43df-4def-8773-ac23c00014d2	e5188eb7-abfc-4697-b18d-60c5884a4403	technology	A tablet for remote classes	Also used by the shelter for evening tutoring sessions.	By maintain recent lose meet yes low Mr respond position live shoulder arm rise cause soldier must whose including model.	2024.63	0.00	MAD	critical	open	Relay point — Marrakech Public Library	Marrakech	Marrakech-Safi	{education,technology}	2026-10-22	A tablet for remote classes. Also used by the shelter for evening tutoring sessions. Category: technology. Urgency: critical. Estimated cost: 2024.63 MAD. Location: Marrakech, Marrakech-Safi.	2026-06-03 13:21:47.489493	2026-09-27 10:56:35.664264
8c0a1b0a-2d87-41af-adf9-0d7a9f4d455d	2c4afb98-bbc6-4916-9abc-d79ec3851a1f	0e3d2e3a-e60d-4fac-9d2a-16a3244b4f4e	health	A course of physical therapy	Ten rehabilitation sessions needed after a surgery.	Material particular general measure direction agreement seek cover word respond night describe third.	809.91	0.00	MAD	critical	open	Relay point — Agadir City Hall	Agadir	Souss-Massa	{health,medical,critical}	2026-11-23	A course of physical therapy. Ten rehabilitation sessions needed after a surgery. Category: health. Urgency: critical. Estimated cost: 809.91 MAD. Location: Agadir, Souss-Massa.	2026-06-11 08:56:22.6789	2026-09-27 10:56:35.664264
866dabba-ff09-4c17-baf7-d0ed14975737	401d541b-fdad-4aa7-9974-7a59092d4bc3	0e3d2e3a-e60d-4fac-9d2a-16a3244b4f4e	health	A month of chronic illness medication	Essential medication to cover one month of treatment.	Party involve kind region nearly able night contain include window majority door more.	824.30	824.30	MAD	high	funded	Relay point — Agadir City Hall	Agadir	Souss-Massa	{health,critical,medical}	2026-10-15	A month of chronic illness medication. Essential medication to cover one month of treatment. Category: health. Urgency: high. Estimated cost: 824.30 MAD. Location: Agadir, Souss-Massa.	2026-04-27 19:08:07.427518	2026-09-27 10:56:35.664264
bd19bdca-bb22-4062-960c-1445d2ea41e8	fdd383be-670c-4b13-a0fb-4586071c265f	e5188eb7-abfc-4697-b18d-60c5884a4403	education	A school bag, fully stocked	Notebooks, pens, a compass set, and a bag sturdy enough to last the whole year.	Suggest how early born option high late step mind mind under near business onto rather show area society old beyond teacher strong feeling somebody.	285.86	285.86	MAD	low	funded	Relay point — Marrakech Public Library	Marrakech	Marrakech-Safi	{school,supplies,back-to-school}	\N	A school bag, fully stocked. Notebooks, pens, a compass set, and a bag sturdy enough to last the whole year. Category: education. Urgency: low. Estimated cost: 285.86 MAD. Location: Marrakech, Marrakech-Safi.	2026-05-05 22:18:35.337611	2026-09-27 10:56:35.664264
5be3244c-87b1-48b2-aae4-c8ed1c168b9c	588ae410-f9a0-42b7-a157-e6848cd0e1d0	3c239bc1-e360-4a06-bec8-c0700145e38f	essentials	Two weeks of groceries, family of five	Enough to cook full meals for two weeks.	Identify model officer from its add possible gun throw party look bit.	461.04	0.00	MAD	high	open	Relay point — Tangier Public Library	Tangier	Tanger-Tetouan-Al Hoceima	{food,family,urgent}	2026-10-05	Two weeks of groceries, family of five. Enough to cook full meals for two weeks. Category: essentials. Urgency: high. Estimated cost: 461.04 MAD. Location: Tangier, Tanger-Tetouan-Al Hoceima.	2026-05-23 15:32:38.04741	2026-09-27 10:56:35.664264
c3c30375-eacb-4b98-b6b7-66c23137e8a4	401d541b-fdad-4aa7-9974-7a59092d4bc3	0e3d2e3a-e60d-4fac-9d2a-16a3244b4f4e	family_care	Three months of infant formula	One tin a month, for a baby whose family is between jobs.	Final late small particularly evidence deal agent since table break create soldier position than effort care trip on former there official visit from.	359.77	0.00	MAD	low	open	Relay point — Agadir City Hall	Agadir	Souss-Massa	{baby,nutrition,urgent}	\N	Three months of infant formula. One tin a month, for a baby whose family is between jobs. Category: family_care. Urgency: low. Estimated cost: 359.77 MAD. Location: Agadir, Souss-Massa.	2026-07-10 18:02:46.606036	2026-09-27 10:56:35.664264
e08dd334-7987-4a5c-b7a1-b0383ea89fac	3a030f4e-3514-41e8-875d-2a2f36797aa9	72fe2390-b53f-4d64-a97a-89b146287aaf	education	A full set of school books	This year's required textbooks, bought new so nothing is missing.	Imagine wait lose popular we section allow accept true voice well option class start detail as action serve less offer eight.	402.67	244.10	MAD	medium	partially_funded	Relay point — ENSAM Tangier	Tangier	Tanger-Tetouan-Al Hoceima	{school,textbooks}	\N	A full set of school books. This year's required textbooks, bought new so nothing is missing. Category: education. Urgency: medium. Estimated cost: 402.67 MAD. Location: Tangier, Tanger-Tetouan-Al Hoceima.	2026-07-27 06:02:03.126538	2026-09-27 10:56:35.664264
eb61c8b9-44ed-4229-a4c7-a1edaad298d1	66c5461d-23be-40f3-a4f5-ce7557bf4960	1783a76b-69f8-44e9-8612-f6e14491718c	education	A school bag, fully stocked	Notebooks, pens, a compass set, and a bag sturdy enough to last the whole year.	Glass student begin low service support beat brother loss agreement candidate though good particular then character back sense step.	211.53	0.00	MAD	critical	open	Relay point — Oujda City Hall	Oujda	L'Oriental	{school,supplies,back-to-school}	2026-11-04	A school bag, fully stocked. Notebooks, pens, a compass set, and a bag sturdy enough to last the whole year. Category: education. Urgency: critical. Estimated cost: 211.53 MAD. Location: Oujda, L'Oriental.	2026-04-30 05:33:00.430875	2026-09-27 10:56:35.664264
d530b865-d09b-40d2-a3a8-45a703b02998	79fc11f9-3918-41da-a7dc-d79ea65f130c	e8547f48-86d0-44d8-a11e-b2a99bdc229e	essentials	A wool blanket for winter	Thick enough for a cold night without heating.	Method rock simple bring detail new this out perform mouth forget fear real live world during black rock conference PM foot suffer travel another.	191.76	191.76	MAD	medium	funded	Relay point — ENSAM Agadir	Agadir	Souss-Massa	{winter,comfort,urgent}	\N	A wool blanket for winter. Thick enough for a cold night without heating. Category: essentials. Urgency: medium. Estimated cost: 191.76 MAD. Location: Agadir, Souss-Massa.	2026-05-23 09:49:05.950105	2026-09-27 10:56:35.664264
11d14ff9-5309-47ec-8c1b-34bd4299d845	ef3c0f18-43df-4def-8773-ac23c00014d2	e5188eb7-abfc-4697-b18d-60c5884a4403	technology	A tablet for remote classes	Also used by the shelter for evening tutoring sessions.	Million page before different even sell to technology size claim letter program though first rise minute factor create.	2188.97	2188.97	MAD	low	delivered	Relay point — Marrakech Public Library	Marrakech	Marrakech-Safi	{education,technology}	\N	A tablet for remote classes. Also used by the shelter for evening tutoring sessions. Category: technology. Urgency: low. Estimated cost: 2188.97 MAD. Location: Marrakech, Marrakech-Safi.	2026-06-15 10:33:16.675135	2026-09-27 10:56:35.664264
27fbb1eb-ca34-48f1-9dc3-7a480ab3579d	f5fac058-4a8f-4ddb-aa3c-3a004265bbc1	1531a2f9-00a2-4857-87b9-1c30d6bdce9f	education	A full set of school books	This year's required textbooks, bought new so nothing is missing.	Place war avoid black ready worry official eye south push final law whose available foreign right enjoy appear carry itself candidate.	356.66	208.26	MAD	medium	partially_funded	Relay point — ENSAM Rabat	Rabat	Rabat-Sale-Kenitra	{school,textbooks}	\N	A full set of school books. This year's required textbooks, bought new so nothing is missing. Category: education. Urgency: medium. Estimated cost: 356.66 MAD. Location: Rabat, Rabat-Sale-Kenitra.	2026-07-28 05:13:36.188265	2026-09-27 10:56:35.664264
\.


--
-- Name: beneficiaries beneficiaries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beneficiaries
    ADD CONSTRAINT beneficiaries_pkey PRIMARY KEY (id);


--
-- Name: donations donations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.donations
    ADD CONSTRAINT donations_pkey PRIMARY KEY (id);


--
-- Name: donors donors_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.donors
    ADD CONSTRAINT donors_email_key UNIQUE (email);


--
-- Name: donors donors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.donors
    ADD CONSTRAINT donors_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: wishes wishes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishes
    ADD CONSTRAINT wishes_pkey PRIMARY KEY (id);


--
-- Name: idx_donations_donor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_donations_donor_id ON public.donations USING btree (donor_id);


--
-- Name: idx_donations_wish_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_donations_wish_id ON public.donations USING btree (wish_id);


--
-- Name: idx_wishes_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wishes_category ON public.wishes USING btree (category);


--
-- Name: idx_wishes_rag_text_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wishes_rag_text_trgm ON public.wishes USING gin (rag_text public.gin_trgm_ops);


--
-- Name: idx_wishes_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wishes_status ON public.wishes USING btree (status);


--
-- Name: idx_wishes_tags; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wishes_tags ON public.wishes USING gin (tags);


--
-- Name: idx_wishes_urgency; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wishes_urgency ON public.wishes USING btree (urgency);


--
-- Name: wishes trg_set_wish_rag_text; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_wish_rag_text BEFORE INSERT OR UPDATE ON public.wishes FOR EACH ROW EXECUTE FUNCTION public.set_wish_rag_text();


--
-- Name: beneficiaries beneficiaries_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beneficiaries
    ADD CONSTRAINT beneficiaries_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: donations donations_donor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.donations
    ADD CONSTRAINT donations_donor_id_fkey FOREIGN KEY (donor_id) REFERENCES public.donors(id) ON DELETE CASCADE;


--
-- Name: donations donations_wish_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.donations
    ADD CONSTRAINT donations_wish_id_fkey FOREIGN KEY (wish_id) REFERENCES public.wishes(id) ON DELETE CASCADE;


--
-- Name: wishes wishes_beneficiary_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishes
    ADD CONSTRAINT wishes_beneficiary_id_fkey FOREIGN KEY (beneficiary_id) REFERENCES public.beneficiaries(id) ON DELETE SET NULL;


--
-- Name: wishes wishes_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishes
    ADD CONSTRAINT wishes_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict Z4zW0jy9lOMlbYFjAsV9qnPc1XQPJPp4z34tS77UNc3x4BKrd7rjlE4u61eQXvG