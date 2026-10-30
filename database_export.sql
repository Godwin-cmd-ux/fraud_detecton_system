--
-- PostgreSQL database dump
--

\restrict 1caAt4nGHVrugVaOJ230LaQeQhnQqF1RfmnAjU4tTvKOKY6mzP5swIrehtJxftU

-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY public.transactions DROP CONSTRAINT IF EXISTS transactions_sender_id_users_id_fk;
ALTER TABLE IF EXISTS ONLY public.transactions DROP CONSTRAINT IF EXISTS transactions_reviewed_by_admins_id_fk;
ALTER TABLE IF EXISTS ONLY public.transactions DROP CONSTRAINT IF EXISTS transactions_receiver_id_users_id_fk;
ALTER TABLE IF EXISTS ONLY public.transactions DROP CONSTRAINT IF EXISTS transactions_admin_id_admins_id_fk;
ALTER TABLE IF EXISTS ONLY public.failed_withdrawal_attempts DROP CONSTRAINT IF EXISTS failed_withdrawal_attempts_user_id_users_id_fk;
ALTER TABLE IF EXISTS ONLY public.admin_actions DROP CONSTRAINT IF EXISTS admin_actions_admin_id_admins_id_fk;
DROP INDEX IF EXISTS public.ussd_sessions_phone_idx;
DROP INDEX IF EXISTS public.ussd_sessions_expires_idx;
DROP INDEX IF EXISTS public.ussd_security_events_type_idx;
DROP INDEX IF EXISTS public.ussd_requests_session_text_uq;
DROP INDEX IF EXISTS public.ussd_requests_phone_idx;
DROP INDEX IF EXISTS public.ussd_requests_created_idx;
DROP INDEX IF EXISTS public.users_reset_token_idx;
DROP INDEX IF EXISTS public.transactions_type_idx;
DROP INDEX IF EXISTS public.transactions_status_idx;
DROP INDEX IF EXISTS public.transactions_sender_created_idx;
DROP INDEX IF EXISTS public.transactions_risk_idx;
DROP INDEX IF EXISTS public.transactions_receiver_created_idx;
DROP INDEX IF EXISTS public.transactions_fraud_idx;
DROP INDEX IF EXISTS public.transactions_created_idx;
DROP INDEX IF EXISTS public.sessions_expire_idx;
DROP INDEX IF EXISTS public.login_attempts_lockout_idx;
DROP INDEX IF EXISTS public.login_attempts_email_ip_idx;
DROP INDEX IF EXISTS public.failed_login_log_email_idx;
ALTER TABLE IF EXISTS ONLY public.ussd_sessions DROP CONSTRAINT IF EXISTS ussd_sessions_pkey;
ALTER TABLE IF EXISTS ONLY public.ussd_security_events DROP CONSTRAINT IF EXISTS ussd_security_events_pkey;
ALTER TABLE IF EXISTS ONLY public.ussd_requests DROP CONSTRAINT IF EXISTS ussd_requests_pkey;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_pkey;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_phone_unique;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_email_unique;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_card_number_unique;
ALTER TABLE IF EXISTS ONLY public.transactions DROP CONSTRAINT IF EXISTS transactions_transaction_id_unique;
ALTER TABLE IF EXISTS ONLY public.transactions DROP CONSTRAINT IF EXISTS transactions_pkey;
ALTER TABLE IF EXISTS ONLY public.sessions DROP CONSTRAINT IF EXISTS sessions_pkey;
ALTER TABLE IF EXISTS ONLY public.security_questions DROP CONSTRAINT IF EXISTS security_questions_question_key_unique;
ALTER TABLE IF EXISTS ONLY public.security_questions DROP CONSTRAINT IF EXISTS security_questions_pkey;
ALTER TABLE IF EXISTS ONLY public.login_attempts DROP CONSTRAINT IF EXISTS login_attempts_pkey;
ALTER TABLE IF EXISTS ONLY public.failed_withdrawal_attempts DROP CONSTRAINT IF EXISTS failed_withdrawal_attempts_pkey;
ALTER TABLE IF EXISTS ONLY public.failed_login_log DROP CONSTRAINT IF EXISTS failed_login_log_pkey;
ALTER TABLE IF EXISTS ONLY public.admins DROP CONSTRAINT IF EXISTS admins_username_unique;
ALTER TABLE IF EXISTS ONLY public.admins DROP CONSTRAINT IF EXISTS admins_pkey;
ALTER TABLE IF EXISTS ONLY public.admins DROP CONSTRAINT IF EXISTS admins_email_unique;
ALTER TABLE IF EXISTS ONLY public.admin_actions DROP CONSTRAINT IF EXISTS admin_actions_pkey;
ALTER TABLE IF EXISTS ONLY drizzle.__drizzle_migrations DROP CONSTRAINT IF EXISTS __drizzle_migrations_pkey;
ALTER TABLE IF EXISTS public.ussd_security_events ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.ussd_requests ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.users ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.transactions ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.security_questions ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.login_attempts ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.failed_login_log ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.admins ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.admin_actions ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS drizzle.__drizzle_migrations ALTER COLUMN id DROP DEFAULT;
DROP TABLE IF EXISTS public.ussd_sessions;
DROP SEQUENCE IF EXISTS public.ussd_security_events_id_seq;
DROP TABLE IF EXISTS public.ussd_security_events;
DROP SEQUENCE IF EXISTS public.ussd_requests_id_seq;
DROP TABLE IF EXISTS public.ussd_requests;
DROP SEQUENCE IF EXISTS public.users_id_seq;
DROP TABLE IF EXISTS public.users;
DROP SEQUENCE IF EXISTS public.transactions_id_seq;
DROP TABLE IF EXISTS public.transactions;
DROP TABLE IF EXISTS public.sessions;
DROP SEQUENCE IF EXISTS public.security_questions_id_seq;
DROP TABLE IF EXISTS public.security_questions;
DROP SEQUENCE IF EXISTS public.login_attempts_id_seq;
DROP TABLE IF EXISTS public.login_attempts;
DROP TABLE IF EXISTS public.failed_withdrawal_attempts;
DROP SEQUENCE IF EXISTS public.failed_login_log_id_seq;
DROP TABLE IF EXISTS public.failed_login_log;
DROP SEQUENCE IF EXISTS public.admins_id_seq;
DROP TABLE IF EXISTS public.admins;
DROP SEQUENCE IF EXISTS public.admin_actions_id_seq;
DROP TABLE IF EXISTS public.admin_actions;
DROP SEQUENCE IF EXISTS drizzle.__drizzle_migrations_id_seq;
DROP TABLE IF EXISTS drizzle.__drizzle_migrations;
DROP TYPE IF EXISTS public.transaction_type;
DROP TYPE IF EXISTS public.transaction_status;
DROP TYPE IF EXISTS public.risk_level;
DROP TYPE IF EXISTS public.fraud_prediction;
DROP TYPE IF EXISTS public.admin_action_type;
DROP SCHEMA IF EXISTS drizzle;
--
-- Name: drizzle; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA drizzle;


--
-- Name: admin_action_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.admin_action_type AS ENUM (
    'add_balance',
    'approve_user',
    'disapprove_user',
    'activate_user',
    'deactivate_user',
    'delete_user',
    'reject_user',
    'create_user',
    'mark_reviewed'
);


--
-- Name: fraud_prediction; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.fraud_prediction AS ENUM (
    'FRAUD',
    'LEGIT',
    'PENDING'
);


--
-- Name: risk_level; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.risk_level AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH'
);


--
-- Name: transaction_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.transaction_status AS ENUM (
    'SUCCESS',
    'ABORTED',
    'PENDING'
);


--
-- Name: transaction_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.transaction_type AS ENUM (
    'transfer',
    'withdrawal',
    'deposit',
    'bonus',
    'refund',
    'adjustment'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: __drizzle_migrations; Type: TABLE; Schema: drizzle; Owner: -
--

CREATE TABLE drizzle.__drizzle_migrations (
    id integer NOT NULL,
    hash text NOT NULL,
    created_at bigint
);


--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE; Schema: drizzle; Owner: -
--

CREATE SEQUENCE drizzle.__drizzle_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: drizzle; Owner: -
--

ALTER SEQUENCE drizzle.__drizzle_migrations_id_seq OWNED BY drizzle.__drizzle_migrations.id;


--
-- Name: admin_actions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_actions (
    id integer NOT NULL,
    admin_id integer NOT NULL,
    admin_name character varying(100) NOT NULL,
    action_type public.admin_action_type NOT NULL,
    user_id integer,
    user_name character varying(100),
    amount numeric(15,2),
    reason text,
    details text,
    ip_address character varying(45),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: admin_actions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.admin_actions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: admin_actions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.admin_actions_id_seq OWNED BY public.admin_actions.id;


--
-- Name: admins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admins (
    id integer NOT NULL,
    username character varying(50) NOT NULL,
    email character varying(100) NOT NULL,
    password_hash character varying(255) NOT NULL,
    full_name character varying(100) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    last_login timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    phone character varying(20),
    pin_hash character varying(255),
    pin_attempts integer DEFAULT 0 NOT NULL,
    pin_locked_until timestamp with time zone
);


--
-- Name: admins_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.admins_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: admins_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.admins_id_seq OWNED BY public.admins.id;


--
-- Name: failed_login_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.failed_login_log (
    id integer NOT NULL,
    email character varying(100) NOT NULL,
    ip_address character varying(45) NOT NULL,
    user_id integer,
    attempted_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: failed_login_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.failed_login_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: failed_login_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.failed_login_log_id_seq OWNED BY public.failed_login_log.id;


--
-- Name: failed_withdrawal_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.failed_withdrawal_attempts (
    user_id integer NOT NULL,
    attempt_count integer DEFAULT 0 NOT NULL,
    last_attempt_time timestamp with time zone
);


--
-- Name: login_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.login_attempts (
    id integer NOT NULL,
    user_id integer,
    email character varying(100) NOT NULL,
    ip_address character varying(45) NOT NULL,
    attempt_count integer DEFAULT 1 NOT NULL,
    lockout_until timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: login_attempts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.login_attempts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: login_attempts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.login_attempts_id_seq OWNED BY public.login_attempts.id;


--
-- Name: security_questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.security_questions (
    id integer NOT NULL,
    question_key character varying(50) NOT NULL,
    question_text character varying(255) NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: security_questions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.security_questions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: security_questions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.security_questions_id_seq OWNED BY public.security_questions.id;


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    sid character varying NOT NULL,
    sess json NOT NULL,
    expire timestamp(6) without time zone NOT NULL
);


--
-- Name: transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transactions (
    id integer NOT NULL,
    transaction_id character varying(50) NOT NULL,
    sender_id integer,
    receiver_id integer,
    sender_name character varying(100),
    receiver_name character varying(100),
    amount numeric(15,2) NOT NULL,
    transaction_type public.transaction_type NOT NULL,
    status public.transaction_status NOT NULL,
    message text,
    fraud_score numeric(5,2) DEFAULT '0'::numeric NOT NULL,
    fraud_prediction public.fraud_prediction,
    risk_level public.risk_level,
    prediction_time timestamp with time zone,
    model_version character varying(20),
    feature_data jsonb,
    transaction_location character varying(100),
    ip_address character varying(45),
    user_agent text,
    admin_id integer,
    reviewed_at timestamp with time zone,
    reviewed_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    tx_lat numeric(9,6),
    tx_lng numeric(9,6),
    fee numeric(15,2) DEFAULT '0'::numeric NOT NULL
);


--
-- Name: transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.transactions_id_seq OWNED BY public.transactions.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    full_name character varying(100) NOT NULL,
    email character varying(100) NOT NULL,
    phone character varying(20) NOT NULL,
    card_number character varying(20) NOT NULL,
    password_hash character varying(255) NOT NULL,
    balance numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    security_answers jsonb,
    is_approved boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    reset_token character varying(64),
    reset_token_expiry timestamp with time zone,
    last_known_location character varying(100),
    location_updated_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    transaction_pin_hash character varying(255),
    pin_attempts integer DEFAULT 0 NOT NULL,
    pin_locked_until timestamp with time zone,
    card_expiry character varying(5),
    card_cvc character varying(3),
    last_lat numeric(9,6),
    last_lng numeric(9,6),
    CONSTRAINT users_balance_non_negative CHECK ((balance >= (0)::numeric))
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: ussd_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ussd_requests (
    id integer NOT NULL,
    session_id character varying(128) NOT NULL,
    phone character varying(20) NOT NULL,
    text_hash character varying(64) NOT NULL,
    text text NOT NULL,
    response text NOT NULL,
    is_end boolean DEFAULT false NOT NULL,
    scene character varying(40),
    actor_kind character varying(10),
    actor_id integer,
    ip_address character varying(45),
    duration_ms integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ussd_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ussd_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ussd_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ussd_requests_id_seq OWNED BY public.ussd_requests.id;


--
-- Name: ussd_security_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ussd_security_events (
    id integer NOT NULL,
    event_type character varying(40) NOT NULL,
    phone character varying(20),
    session_id character varying(128),
    detail text,
    ip_address character varying(45),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ussd_security_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ussd_security_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ussd_security_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ussd_security_events_id_seq OWNED BY public.ussd_security_events.id;


--
-- Name: ussd_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ussd_sessions (
    id character varying(128) NOT NULL,
    phone character varying(20) NOT NULL,
    actor_kind character varying(10),
    actor_id integer,
    state jsonb NOT NULL,
    last_text text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL
);


--
-- Name: __drizzle_migrations id; Type: DEFAULT; Schema: drizzle; Owner: -
--

ALTER TABLE ONLY drizzle.__drizzle_migrations ALTER COLUMN id SET DEFAULT nextval('drizzle.__drizzle_migrations_id_seq'::regclass);


--
-- Name: admin_actions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_actions ALTER COLUMN id SET DEFAULT nextval('public.admin_actions_id_seq'::regclass);


--
-- Name: admins id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admins ALTER COLUMN id SET DEFAULT nextval('public.admins_id_seq'::regclass);


--
-- Name: failed_login_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.failed_login_log ALTER COLUMN id SET DEFAULT nextval('public.failed_login_log_id_seq'::regclass);


--
-- Name: login_attempts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.login_attempts ALTER COLUMN id SET DEFAULT nextval('public.login_attempts_id_seq'::regclass);


--
-- Name: security_questions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_questions ALTER COLUMN id SET DEFAULT nextval('public.security_questions_id_seq'::regclass);


--
-- Name: transactions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions ALTER COLUMN id SET DEFAULT nextval('public.transactions_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: ussd_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ussd_requests ALTER COLUMN id SET DEFAULT nextval('public.ussd_requests_id_seq'::regclass);


--
-- Name: ussd_security_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ussd_security_events ALTER COLUMN id SET DEFAULT nextval('public.ussd_security_events_id_seq'::regclass);


--
-- Data for Name: __drizzle_migrations; Type: TABLE DATA; Schema: drizzle; Owner: -
--

COPY drizzle.__drizzle_migrations (id, hash, created_at) FROM stdin;
1	a725d45da2affb1043f258aa6321f5c5e344ab94bbf73dd732bd15ad83a47411	1793304713709
2	c0d7b9ca995e5dc15c399db3d7b064180ffb668d51501fd8eee0f4006d4aa338	1793352743060
3	2939a2979a39c4c71374a887c6ac0ca1a63527eac6031b9d3834d45d2f1604dd	1793360726691
4	30df60b456b8852d2e11646bf3b398e6c00d968901839fbf4b873ce7285bbbc8	1793363263595
\.


--
-- Data for Name: admin_actions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.admin_actions (id, admin_id, admin_name, action_type, user_id, user_name, amount, reason, details, ip_address, created_at) FROM stdin;
1	3	GIDEON SAMUEL MSUYA	add_balance	6	Marie Curie	600000.00	open account	\N	::1	2026-06-20 02:14:47+03
2	3	GIDEON SAMUEL MSUYA	add_balance	4	COSMA COSMA VICTORINI	5000000.00	for testing	\N	::1	2026-07-12 16:58:25+03
3	3	GIDEON SAMUEL MSUYA	add_balance	4	COSMA COSMA VICTORINI	10000000.00	for testing	\N	::1	2026-07-12 17:08:45+03
4	3	GIDEON SAMUEL MSUYA	add_balance	4	COSMA COSMA VICTORINI	10000000.00	for testing	\N	::1	2026-07-13 01:09:59+03
5	3	GIDEON SAMUEL MSUYA	add_balance	4	COSMA COSMA VICTORINI	10000000.00	for testing	\N	::1	2026-07-13 01:10:20+03
6	1	System Administrator	approve_user	24	FRANK GODWIN	\N	VALID	User account approved	::1	2026-10-30 12:04:14+03
7	1	System Administrator	add_balance	24	FRANK GODWIN	2000000.00	initial amount	\N	::1	2026-10-30 13:30:50.042586+03
8	1	System Administrator	approve_user	25	FRANK GODWIN	\N	valid user	User account approved	::1	2026-10-30 14:02:29.778052+03
9	1	System Administrator	add_balance	25	FRANK GODWIN	2000000.00	initial balance deposited	\N	::1	2026-10-30 14:03:27.259147+03
10	1	System Administrator	add_balance	20	Juma Mwangi	1500.00	SMS delivery check	\N	::1	2026-10-30 14:18:23.989278+03
\.


--
-- Data for Name: admins; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.admins (id, username, email, password_hash, full_name, is_active, last_login, created_at, phone, pin_hash, pin_attempts, pin_locked_until) FROM stdin;
2	Franco	godwinfranklin419@gmail.com	$2y$10$kgQf9nbzkYyap8qEN052DuqmWU7xehV3aRRNi4Q6hvcvmJxSzdYAq	FRANK GODWIN	t	2026-06-22 15:45:06+03	2026-05-13 23:33:37+03	\N	\N	0	\N
3	Gee	gideonmsuya@gmail.com	$2y$10$9lSuYdoVCrNDykpP9Xx/gu3pFL1xSXdMGdvUuWTbTSEg5XCk/Uxiq	GIDEON SAMUEL MSUYA	t	2026-07-30 13:44:22+03	2026-05-15 12:00:57+03	\N	\N	0	\N
1	admin	admin@frauddetection.com	$2b$10$S5U.lcbweRLieAb74GMWcuo54GgJkEyT4r0.wJa1DpPOGtsDbdv3K	System Administrator	t	2026-10-30 14:18:23.531+03	2026-05-13 13:47:31+03	\N	\N	0	\N
\.


--
-- Data for Name: failed_login_log; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.failed_login_log (id, email, ip_address, user_id, attempted_at) FROM stdin;
1	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:33:09+03
2	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:33:19+03
3	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:33:26+03
4	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:33:27+03
5	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:33:29+03
6	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:33:30+03
7	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:33:31+03
8	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:33:32+03
9	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:33:33+03
10	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:33:35+03
11	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:33:36+03
12	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:33:37+03
13	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:33:38+03
14	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:33:40+03
15	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:33:41+03
16	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:33:42+03
17	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:33:43+03
18	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:33:45+03
19	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:33:46+03
20	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:33:47+03
21	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:33:48+03
22	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:33:50+03
23	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:33:51+03
24	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:33:52+03
25	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:33:53+03
26	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:33:54+03
27	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:33:56+03
28	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:33:57+03
29	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:33:58+03
30	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:33:59+03
31	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:34:01+03
32	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:34:02+03
33	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:34:04+03
34	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:34:06+03
35	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:34:08+03
36	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:34:10+03
37	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:34:12+03
38	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:34:14+03
39	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:34:16+03
40	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:34:18+03
41	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:34:20+03
42	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:34:22+03
43	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:34:24+03
44	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:34:26+03
45	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:34:28+03
46	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:34:30+03
47	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:34:32+03
48	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:34:34+03
49	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:34:36+03
50	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:34:38+03
51	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:34:40+03
52	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:34:42+03
53	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:34:44+03
54	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:34:46+03
55	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:34:48+03
56	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:34:50+03
57	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:34:52+03
58	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:34:54+03
59	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:34:56+03
60	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:34:58+03
61	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:35:00+03
62	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:35:02+03
63	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:35:04+03
64	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:35:06+03
65	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:35:08+03
66	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:35:10+03
67	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:35:12+03
68	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:35:14+03
69	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:35:16+03
70	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:35:18+03
71	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:35:20+03
72	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:35:22+03
73	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:35:23+03
74	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:35:24+03
75	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:35:25+03
76	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:35:27+03
77	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:35:29+03
78	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:35:31+03
79	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:35:33+03
80	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:35:35+03
81	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:35:37+03
82	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:35:39+03
83	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:35:41+03
84	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:35:43+03
85	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:35:45+03
86	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:35:47+03
87	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:35:49+03
88	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:35:51+03
89	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:35:53+03
90	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:35:55+03
91	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:35:57+03
92	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:35:59+03
93	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:36:01+03
94	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:36:03+03
95	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:36:05+03
96	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:36:07+03
97	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:36:09+03
98	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:36:11+03
99	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:36:13+03
100	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:36:15+03
101	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:36:18+03
102	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:36:19+03
103	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:36:21+03
104	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:36:23+03
105	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:36:25+03
106	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:36:27+03
107	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:36:29+03
108	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:36:31+03
109	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:36:33+03
110	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:41:35+03
111	godwinfranklin419@gmail.com	::1	5	2026-07-13 01:50:41+03
112	lkhgcfh	::1	\N	2026-07-30 11:59:44+03
113	hugyhfgxfch	::1	\N	2026-07-30 11:59:53+03
114	hgfxchjkl	::1	\N	2026-07-30 12:00:11+03
115	lkhjgcfhjk	::1	\N	2026-07-30 12:00:22+03
116	gutytdfghj	::1	\N	2026-07-30 12:00:35+03
117	gutytdfghj	::1	\N	2026-07-30 13:39:20+03
118	godwinfranklin419@gmail.com	::1	5	2026-07-30 13:42:15+03
119	godwinfranklin419@gmail.com	::1	5	2026-07-30 13:42:24+03
120	godwinfranklin419@gmail.com	::1	5	2026-07-30 13:42:49+03
121	godwinfranklin418@gmail.com	::1	4	2026-07-30 13:48:33+03
122	godwinfranklin419@gmail.com	::1	5	2026-07-30 13:50:00+03
123	godwinfranklin419@gmail.com	::1	5	2026-07-30 13:50:09+03
124	godwinfranklin418@gmail.com	::1	4	2026-07-30 13:50:31+03
125	godwinfranklin419@gmail.com	::1	5	2026-07-30 13:50:46+03
126	Frank	::1	\N	2026-10-30 09:26:00+03
127	godwinfranklin411@gmail.com	::1	\N	2026-10-30 13:32:42.625+03
128	godwinfranklin411@gmail.com	::1	\N	2026-10-30 13:33:00.059+03
129	godwinfranklin411@gmail.com	::1	\N	2026-10-30 15:37:48.014+03
\.


--
-- Data for Name: failed_withdrawal_attempts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.failed_withdrawal_attempts (user_id, attempt_count, last_attempt_time) FROM stdin;
4	0	\N
23	0	\N
\.


--
-- Data for Name: login_attempts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.login_attempts (id, user_id, email, ip_address, attempt_count, lockout_until, created_at, updated_at) FROM stdin;
1	5	godwinfranklin419@gmail.com	::1	0	\N	2026-07-13 01:33:09+03	2026-07-30 13:50:56+03
2	\N	lkhgcfh	::1	1	\N	2026-07-30 11:59:44+03	2026-07-30 11:59:44+03
3	\N	hugyhfgxfch	::1	1	\N	2026-07-30 11:59:53+03	2026-07-30 11:59:53+03
4	\N	hgfxchjkl	::1	1	\N	2026-07-30 12:00:11+03	2026-07-30 12:00:11+03
5	\N	lkhjgcfhjk	::1	1	\N	2026-07-30 12:00:22+03	2026-07-30 12:00:22+03
6	\N	gutytdfghj	::1	2	\N	2026-07-30 12:00:35+03	2026-07-30 13:39:20+03
7	4	godwinfranklin418@gmail.com	::1	2	\N	2026-07-30 13:48:33+03	2026-07-30 13:50:31+03
8	\N	Frank	::1	1	\N	2026-10-30 09:26:00+03	2026-10-30 09:26:00+03
9	\N	godwinfranklin411@gmail.com	::1	0	\N	2026-10-30 13:32:42.625+03	2026-10-30 15:37:48.014+03
\.


--
-- Data for Name: security_questions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.security_questions (id, question_key, question_text, is_active) FROM stdin;
1	primary_school	What is your primary school name?	t
2	favorite_food	What is your favorite food?	t
3	mother_full_name	What is your mother's full name?	t
4	hobby	What is your hobby?	t
5	dream_place	What place do you wish to live in?	t
6	mother_maiden	What is your mother's maiden name?	t
7	first_school	What was the name of your first school?	t
8	birth_city	In which city were you born?	t
9	first_pet	What was your first pet's name?	t
10	favorite_teacher	Who was your favourite teacher?	t
11	childhood_nickname	What was your childhood nickname?	t
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sessions (sid, sess, expire) FROM stdin;
DrzDx5ImscqtRBjJAAALKQNNfhJvpsgr	{"cookie":{"originalMaxAge":1800000,"expires":"2026-10-30T13:21:50.513Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"principal":{"kind":"user","id":23,"name":"Frank","email":"frank@example.com"},"rateLimits":{"verify":{"count":1,"windowStart":1793364710332}},"balanceRevealedUntil":1793365010512}	2026-10-30 16:21:51
\.


--
-- Data for Name: transactions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.transactions (id, transaction_id, sender_id, receiver_id, sender_name, receiver_name, amount, transaction_type, status, message, fraud_score, fraud_prediction, risk_level, prediction_time, model_version, feature_data, transaction_location, ip_address, user_agent, admin_id, reviewed_at, reviewed_by, created_at, tx_lat, tx_lng, fee) FROM stdin;
4	TXN202605200654457096	4	5	COSMA COSMA VICTORINI	Christian Mahuve	200000.00	transfer	SUCCESS	payment offer	0.00	PENDING	LOW	\N	1.0.0	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	\N	\N	\N	2026-05-20 07:54:45+03	\N	\N	0.00
5	TXN202605200656081621	4	\N	COSMA COSMA VICTORINI	\N	200000.00	withdrawal	SUCCESS	for spending	0.00	PENDING	LOW	\N	1.0.0	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	\N	\N	\N	2026-05-20 07:56:08+03	\N	\N	0.00
6	TXN202606200114479061	\N	6	\N	Marie Curie	600000.00	deposit	SUCCESS	Admin adjustment: open account	0.00	PENDING	LOW	\N	1.0.0	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	\N	\N	2026-06-20 02:14:47+03	\N	\N	0.00
7	TXN202606200121315635	5	4	Christian Mahuve	COSMA COSMA VICTORINI	40000.00	transfer	SUCCESS	school fee	0.00	PENDING	LOW	2026-06-20 01:21:31+03	1.0.0	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	\N	\N	2026-06-20 02:21:31+03	\N	\N	0.00
8	TXN202606200122166746	5	\N	Christian Mahuve	\N	20000.00	withdrawal	SUCCESS	for personal use	0.00	PENDING	LOW	\N	1.0.0	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	\N	\N	2026-06-20 02:22:16+03	\N	\N	0.00
9	TXN202606200134183859	5	\N	Christian Mahuve	\N	40000.00	withdrawal	SUCCESS	for use	0.00	PENDING	LOW	2026-06-20 01:34:18+03	1.0.0	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	\N	\N	2026-06-20 02:34:18+03	\N	\N	0.00
10	TXN202606201123054616	5	4	Christian Mahuve	COSMA COSMA VICTORINI	20000.00	transfer	SUCCESS	take it as a gift	0.00	PENDING	LOW	\N	1.0.0	\N	Dar es Salaam	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	\N	\N	2026-06-20 12:23:56+03	\N	\N	0.00
11	TXN202606201124322686	5	4	Christian Mahuve	COSMA COSMA VICTORINI	20000.00	transfer	SUCCESS	take it as a gift	60.00	FRAUD	MEDIUM	\N	1.0.0	\N	Mwanza	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	\N	\N	2026-06-20 12:25:23+03	\N	\N	0.00
20	TXN_RECV_6a3661d420f87	12	17	Fraud Receiver 1	Target User	38938.00	transfer	SUCCESS	Received from sender 1	73.00	FRAUD	HIGH	\N	1.0.0	\N	Dar es Salaam	\N	\N	\N	\N	\N	2026-06-20 12:44:04+03	\N	\N	0.00
21	TXN_RECV_6a3661d421f4e	13	17	Fraud Receiver 2	Target User	36598.00	transfer	SUCCESS	Received from sender 2	76.00	FRAUD	HIGH	\N	1.0.0	\N	Dar es Salaam	\N	\N	\N	\N	\N	2026-06-20 12:45:04+03	\N	\N	0.00
22	TXN_RECV_6a3661d42357b	14	17	Fraud Receiver 3	Target User	34740.00	transfer	SUCCESS	Received from sender 3	79.00	FRAUD	HIGH	\N	1.0.0	\N	Dar es Salaam	\N	\N	\N	\N	\N	2026-06-20 12:46:04+03	\N	\N	0.00
23	TXN_RECV_6a3661d424944	15	17	Fraud Receiver 4	Target User	41725.00	transfer	SUCCESS	Received from sender 4	82.00	FRAUD	HIGH	\N	1.0.0	\N	Dar es Salaam	\N	\N	\N	\N	\N	2026-06-20 12:47:04+03	\N	\N	0.00
24	TXN_RECV_6a3661d425c61	16	17	Fraud Receiver 5	Target User	38044.00	transfer	SUCCESS	Received from sender 5	85.00	FRAUD	HIGH	\N	1.0.0	\N	Dar es Salaam	\N	\N	\N	\N	\N	2026-06-20 12:48:04+03	\N	\N	0.00
55	TXN_RECV_6a3662ddc81a2	12	17	Fraud Receiver 1	Target User	40627.00	transfer	SUCCESS	Received from sender 1	73.00	FRAUD	HIGH	\N	1.0.0	\N	Dar es Salaam	\N	\N	\N	\N	\N	2026-06-20 12:53:29+03	\N	\N	0.00
56	TXN_RECV_6a3662ddca4af	13	17	Fraud Receiver 2	Target User	48528.00	transfer	SUCCESS	Received from sender 2	76.00	FRAUD	HIGH	\N	1.0.0	\N	Dar es Salaam	\N	\N	\N	\N	\N	2026-06-20 12:54:29+03	\N	\N	0.00
57	TXN_RECV_6a3662ddcccee	14	17	Fraud Receiver 3	Target User	37507.00	transfer	SUCCESS	Received from sender 3	79.00	FRAUD	HIGH	\N	1.0.0	\N	Dar es Salaam	\N	\N	\N	\N	\N	2026-06-20 12:55:29+03	\N	\N	0.00
58	TXN_RECV_6a3662ddce915	15	17	Fraud Receiver 4	Target User	32202.00	transfer	SUCCESS	Received from sender 4	82.00	FRAUD	HIGH	\N	1.0.0	\N	Dar es Salaam	\N	\N	\N	\N	\N	2026-06-20 12:56:29+03	\N	\N	0.00
59	TXN_RECV_6a3662ddd0148	16	17	Fraud Receiver 5	Target User	43059.00	transfer	SUCCESS	Received from sender 5	85.00	FRAUD	HIGH	\N	1.0.0	\N	Dar es Salaam	\N	\N	\N	\N	\N	2026-06-20 12:57:29+03	\N	\N	0.00
90	TXN_RECV_6a367bcbbf81d	12	17	Fraud Receiver 1	Target User	42823.00	transfer	SUCCESS	Received from sender 1	73.00	FRAUD	HIGH	\N	1.0.0	\N	Dar es Salaam	\N	\N	\N	\N	\N	2026-06-20 14:39:51+03	\N	\N	0.00
91	TXN_RECV_6a367bcbc08c3	13	17	Fraud Receiver 2	Target User	31739.00	transfer	SUCCESS	Received from sender 2	76.00	FRAUD	HIGH	\N	1.0.0	\N	Dar es Salaam	\N	\N	\N	\N	\N	2026-06-20 14:40:51+03	\N	\N	0.00
92	TXN_RECV_6a367bcbc1cc6	14	17	Fraud Receiver 3	Target User	31125.00	transfer	SUCCESS	Received from sender 3	79.00	FRAUD	HIGH	\N	1.0.0	\N	Dar es Salaam	\N	\N	\N	\N	\N	2026-06-20 14:41:51+03	\N	\N	0.00
93	TXN_RECV_6a367bcbc2e92	15	17	Fraud Receiver 4	Target User	32274.00	transfer	SUCCESS	Received from sender 4	82.00	FRAUD	HIGH	\N	1.0.0	\N	Dar es Salaam	\N	\N	\N	\N	\N	2026-06-20 14:42:51+03	\N	\N	0.00
94	TXN_RECV_6a367bcbc40d7	16	17	Fraud Receiver 5	Target User	31664.00	transfer	SUCCESS	Received from sender 5	85.00	FRAUD	HIGH	\N	1.0.0	\N	Dar es Salaam	\N	\N	\N	\N	\N	2026-06-20 14:43:51+03	\N	\N	0.00
117	TXN_TEST_6a368b078d177	11	12	Fraud Test User	Test Receiver	4000000.00	transfer	SUCCESS	Large transaction 4,000,000 TSh	80.00	FRAUD	HIGH	\N	1.0.0	\N	Dar es Salaam	\N	\N	\N	\N	\N	2026-06-20 15:43:51+03	\N	\N	0.00
118	TXN_TEST_6a368b078f707	11	12	Fraud Test User	Test Receiver	5000000.00	transfer	SUCCESS	Large transaction 5,000,000 TSh	85.00	FRAUD	HIGH	\N	1.0.0	\N	Dar es Salaam	\N	\N	\N	\N	\N	2026-06-20 15:45:51+03	\N	\N	0.00
119	TXN_TEST_6a368b0790535	11	12	Fraud Test User	Test Receiver	6000000.00	transfer	SUCCESS	Large transaction 6,000,000 TSh	90.00	FRAUD	HIGH	\N	1.0.0	\N	Dar es Salaam	\N	\N	\N	\N	\N	2026-06-20 15:47:51+03	\N	\N	0.00
125	TXN_RECV_6a368b09a86d1	12	17	Fraud Receiver 1	Target User	33292.00	transfer	SUCCESS	Received from sender 1	73.00	FRAUD	HIGH	\N	1.0.0	\N	Dar es Salaam	\N	\N	\N	\N	\N	2026-06-20 15:44:53+03	\N	\N	0.00
126	TXN_RECV_6a368b09a97ec	13	17	Fraud Receiver 2	Target User	43939.00	transfer	SUCCESS	Received from sender 2	76.00	FRAUD	HIGH	\N	1.0.0	\N	Dar es Salaam	\N	\N	\N	\N	\N	2026-06-20 15:45:53+03	\N	\N	0.00
127	TXN_RECV_6a368b09aa63e	14	17	Fraud Receiver 3	Target User	33377.00	transfer	SUCCESS	Received from sender 3	79.00	FRAUD	HIGH	\N	1.0.0	\N	Dar es Salaam	\N	\N	\N	\N	\N	2026-06-20 15:46:53+03	\N	\N	0.00
128	TXN_RECV_6a368b09ab8ec	15	17	Fraud Receiver 4	Target User	44731.00	transfer	SUCCESS	Received from sender 4	82.00	FRAUD	HIGH	\N	1.0.0	\N	Dar es Salaam	\N	\N	\N	\N	\N	2026-06-20 15:47:53+03	\N	\N	0.00
129	TXN_RECV_6a368b09ac80f	16	17	Fraud Receiver 5	Target User	42057.00	transfer	SUCCESS	Received from sender 5	85.00	FRAUD	HIGH	\N	1.0.0	\N	Dar es Salaam	\N	\N	\N	\N	\N	2026-06-20 15:48:53+03	\N	\N	0.00
130	TXN_TEST_6a368b0ab0b49	11	12	Fraud Test User	Test Receiver	500000.00	withdrawal	ABORTED	Failed withdrawal attempt 1	85.00	FRAUD	HIGH	\N	1.0.0	\N	Dar es Salaam	\N	\N	\N	\N	\N	2026-06-20 15:43:54+03	\N	\N	0.00
131	TXN_TEST_6a368b0ab1529	11	12	Fraud Test User	Test Receiver	400000.00	withdrawal	ABORTED	Failed withdrawal attempt 2	88.00	FRAUD	HIGH	\N	1.0.0	\N	Dar es Salaam	\N	\N	\N	\N	\N	2026-06-20 15:44:54+03	\N	\N	0.00
132	TXN_TEST_6a368b0ab22ed	11	12	Fraud Test User	Test Receiver	300000.00	withdrawal	ABORTED	Failed withdrawal attempt 3	91.00	FRAUD	HIGH	\N	1.0.0	\N	Dar es Salaam	\N	\N	\N	\N	\N	2026-06-20 15:45:54+03	\N	\N	0.00
133	TXN_TEST_6a368b0ab2fba	11	12	Fraud Test User	Test Receiver	250000.00	withdrawal	ABORTED	Failed withdrawal attempt 4	94.00	FRAUD	HIGH	\N	1.0.0	\N	Dar es Salaam	\N	\N	\N	\N	\N	2026-06-20 15:46:54+03	\N	\N	0.00
134	TXN_TEST_6a368b0ab3e60	11	12	Fraud Test User	Test Receiver	200000.00	withdrawal	ABORTED	Failed withdrawal attempt 5	97.00	FRAUD	HIGH	\N	1.0.0	\N	Dar es Salaam	\N	\N	\N	\N	\N	2026-06-20 15:47:54+03	\N	\N	0.00
135	TXN_TEST_6a368b0bbf950	11	12	Fraud Test User	Test Receiver	25000.00	transfer	SUCCESS	Normal transaction 1	5.00	LEGIT	LOW	\N	1.0.0	\N	Dar es Salaam	\N	\N	\N	\N	\N	2026-06-20 14:00:00+03	\N	\N	0.00
136	TXN_TEST_6a368b0bc0a4f	11	12	Fraud Test User	Test Receiver	30000.00	transfer	SUCCESS	Normal transaction 2	5.00	LEGIT	LOW	\N	1.0.0	\N	Dar es Salaam	\N	\N	\N	\N	\N	2026-06-20 14:10:00+03	\N	\N	0.00
137	TXN_TEST_6a368b0bc1aa9	11	12	Fraud Test User	Test Receiver	15000.00	transfer	SUCCESS	Normal transaction 3	5.00	LEGIT	LOW	\N	1.0.0	\N	Dar es Salaam	\N	\N	\N	\N	\N	2026-06-20 14:20:00+03	\N	\N	0.00
138	TXN_TEST_6a368b0bc2d69	11	12	Fraud Test User	Test Receiver	40000.00	transfer	SUCCESS	Normal transaction 4	5.00	LEGIT	LOW	\N	1.0.0	\N	Dar es Salaam	\N	\N	\N	\N	\N	2026-06-20 14:30:00+03	\N	\N	0.00
139	TXN_TEST_6a368b0bc3f0d	11	12	Fraud Test User	Test Receiver	20000.00	transfer	SUCCESS	Normal transaction 5	5.00	LEGIT	LOW	\N	1.0.0	\N	Dar es Salaam	\N	\N	\N	\N	\N	2026-06-20 14:40:00+03	\N	\N	0.00
140	TXN_TEST_6a368b0bc4f92	11	12	Fraud Test User	Test Receiver	10000000.00	transfer	SUCCESS	Abnormal transaction at 3:15 AM	85.00	FRAUD	HIGH	\N	1.0.0	\N	Dar es Salaam	\N	\N	\N	\N	\N	2026-06-20 03:15:00+03	\N	\N	0.00
141	TXN_TEST_6a368b0bc6194	11	12	Fraud Test User	Test Receiver	450000.00	transfer	SUCCESS	Transaction from Dar es Salaam	20.00	LEGIT	LOW	\N	1.0.0	\N	Dar es Salaam	\N	\N	\N	\N	\N	2026-06-20 15:43:55+03	\N	\N	0.00
142	TXN_TEST_6a368b0bc7382	11	12	Fraud Test User	Test Receiver	450000.00	transfer	SUCCESS	Transaction from Mwanza	45.00	PENDING	MEDIUM	\N	1.0.0	\N	Mwanza	\N	\N	\N	\N	\N	2026-06-20 15:45:55+03	\N	\N	0.00
143	TXN_TEST_6a368b0bc8506	11	12	Fraud Test User	Test Receiver	450000.00	transfer	SUCCESS	Transaction from Arusha	70.00	FRAUD	HIGH	\N	1.0.0	\N	Arusha	\N	\N	\N	\N	\N	2026-06-20 15:47:55+03	\N	\N	0.00
144	TXN_TEST_6a368b0cccf48	11	12	Fraud Test User	Test Receiver	5000000.00	transfer	SUCCESS	Combined fraud transaction	90.00	FRAUD	HIGH	\N	1.0.0	\N	Dar es Salaam	\N	\N	\N	\N	\N	2026-06-20 15:43:56+03	\N	\N	0.00
145	TXN_TEST_6a368b0ccebc1	11	13	Fraud Test User	Test Receiver	4500000.00	transfer	SUCCESS	Combined fraud transaction	90.00	FRAUD	HIGH	\N	1.0.0	\N	Mwanza	\N	\N	\N	\N	\N	2026-06-20 15:45:56+03	\N	\N	0.00
146	TXN_TEST_6a368b0cd1188	11	14	Fraud Test User	Test Receiver	5500000.00	transfer	SUCCESS	Combined fraud transaction	90.00	FRAUD	HIGH	\N	1.0.0	\N	Arusha	\N	\N	\N	\N	\N	2026-06-20 15:47:56+03	\N	\N	0.00
147	TXN_TEST_6a368b0dd4c23	11	12	Fraud Test User	Test Receiver	5000.00	transfer	SUCCESS	Normal transaction 1	5.00	LEGIT	LOW	\N	1.0.0	\N	Dar es Salaam	\N	\N	\N	\N	\N	2026-06-20 15:43:57+03	\N	\N	0.00
148	TXN_TEST_6a368b0dd57dd	11	12	Fraud Test User	Test Receiver	8000.00	transfer	SUCCESS	Normal transaction 2	5.00	LEGIT	LOW	\N	1.0.0	\N	Dar es Salaam	\N	\N	\N	\N	\N	2026-06-20 16:43:57+03	\N	\N	0.00
149	TXN_TEST_6a368b0dd6488	11	12	Fraud Test User	Test Receiver	3000.00	transfer	SUCCESS	Normal transaction 3	5.00	LEGIT	LOW	\N	1.0.0	\N	Dar es Salaam	\N	\N	\N	\N	\N	2026-06-20 17:43:57+03	\N	\N	0.00
150	TXN_TEST_6a368b0dd7348	11	12	Fraud Test User	Test Receiver	12000.00	transfer	SUCCESS	Normal transaction 4	5.00	LEGIT	LOW	\N	1.0.0	\N	Dar es Salaam	\N	\N	\N	\N	\N	2026-06-20 18:43:57+03	\N	\N	0.00
151	TXN_TEST_6a368b0dd8044	11	12	Fraud Test User	Test Receiver	6000.00	transfer	SUCCESS	Normal transaction 5	5.00	LEGIT	LOW	\N	1.0.0	\N	Dar es Salaam	\N	\N	\N	\N	\N	2026-06-20 19:43:57+03	\N	\N	0.00
152	TXN202607121543555692	4	18	COSMA COSMA VICTORINI	COSMA COSMA VICTORINE	5000.00	transfer	SUCCESS	for use today sunday	3.00	LEGIT	LOW	2026-07-12 16:43:55+03	1.0.0	\N	Dar es Salaam	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	\N	\N	2026-07-12 16:44:46+03	\N	\N	0.00
153	TXN202607121547517278	4	18	COSMA COSMA VICTORINI	COSMA COSMA VICTORINE	5000.00	transfer	SUCCESS	for use today sunday	3.00	LEGIT	LOW	2026-07-12 16:47:51+03	1.0.0	\N	Dar es Salaam	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	\N	\N	2026-07-12 16:48:42+03	\N	\N	0.00
154	TXN202607121558253789	\N	4	\N	COSMA COSMA VICTORINI	5000000.00	deposit	SUCCESS	Admin adjustment: for testing	0.00	PENDING	LOW	\N	1.0.0	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	\N	\N	2026-07-12 16:58:25+03	\N	\N	0.00
155	TXN202607121600228947	4	18	COSMA COSMA VICTORINI	COSMA COSMA VICTORINE	11000000.00	transfer	ABORTED	BLOCKED: Transaction amount exceeds security threshold | for test	90.00	FRAUD	HIGH	2026-07-12 17:00:22+03	1.0.0	\N	Dar es Salaam	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	\N	\N	2026-07-12 17:00:22+03	\N	\N	0.00
156	TXN202607121602123687	4	18	COSMA COSMA VICTORINI	COSMA COSMA VICTORINE	11000000.00	transfer	ABORTED	BLOCKED: Transaction amount exceeds security threshold | for test	90.00	FRAUD	HIGH	2026-07-12 17:02:12+03	1.0.0	\N	Dar es Salaam	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	\N	\N	2026-07-12 17:02:12+03	\N	\N	0.00
157	TXN202607121602531005	4	18	COSMA COSMA VICTORINI	COSMA COSMA VICTORINE	11000000.00	transfer	ABORTED	BLOCKED: Transaction amount exceeds security threshold | for testing	90.00	FRAUD	HIGH	2026-07-12 17:02:53+03	1.0.0	\N	Dar es Salaam	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	\N	\N	2026-07-12 17:02:53+03	\N	\N	0.00
158	TXN202607121608453288	\N	4	\N	COSMA COSMA VICTORINI	10000000.00	deposit	SUCCESS	Admin adjustment: for testing	0.00	PENDING	LOW	\N	1.0.0	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	\N	\N	2026-07-12 17:08:45+03	\N	\N	0.00
159	TXN202607121609569806	4	18	COSMA COSMA VICTORINI	COSMA COSMA VICTORINE	4000000.00	transfer	SUCCESS	for testing	2.00	LEGIT	LOW	2026-07-12 17:09:56+03	1.0.0	\N	Dar es Salaam	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	\N	\N	2026-07-12 17:10:47+03	\N	\N	0.00
160	TXN202607121611124059	4	18	COSMA COSMA VICTORINI	COSMA COSMA VICTORINE	5000000.00	transfer	SUCCESS	for testng	14.00	LEGIT	LOW	2026-07-12 17:11:12+03	1.0.0	\N	Dar es Salaam	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	\N	\N	2026-07-12 17:12:03+03	\N	\N	0.00
161	TXN202607121612313471	4	18	COSMA COSMA VICTORINI	COSMA COSMA VICTORINE	6000000.00	transfer	SUCCESS	for testing	12.00	LEGIT	LOW	2026-07-12 17:12:31+03	1.0.0	\N	Dar es Salaam	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	\N	\N	2026-07-12 17:13:23+03	\N	\N	0.00
162	TXN202607121616042749	4	5	COSMA COSMA VICTORINI	Christian Mahuve	50000.00	transfer	SUCCESS	for testng	10.00	LEGIT	LOW	2026-07-12 17:16:04+03	1.0.0	\N	Dar es Salaam	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	\N	\N	2026-07-12 17:16:55+03	\N	\N	0.00
163	TXN202607121617167892	4	18	COSMA COSMA VICTORINI	COSMA COSMA VICTORINE	60000.00	transfer	SUCCESS	for testing	13.00	LEGIT	LOW	2026-07-12 17:17:16+03	1.0.0	\N	Dar es Salaam	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	\N	\N	2026-07-12 17:18:07+03	\N	\N	0.00
164	TXN202607121618288222	4	12	COSMA COSMA VICTORINI	Fraud Receiver 1	65000.00	transfer	SUCCESS	for testng	8.00	LEGIT	LOW	2026-07-12 17:18:28+03	1.0.0	\N	Dar es Salaam	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	\N	\N	2026-07-12 17:19:19+03	\N	\N	0.00
165	TXN202607121619393141	4	13	COSMA COSMA VICTORINI	Fraud Receiver 2	70000.00	transfer	SUCCESS	ytdfzxfghk	9.00	LEGIT	LOW	2026-07-12 17:19:39+03	1.0.0	\N	Dar es Salaam	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	\N	\N	2026-07-12 17:20:30+03	\N	\N	0.00
166	TXN202607121801575163	4	\N	COSMA COSMA VICTORINI	\N	400000.00	withdrawal	SUCCESS	jknm,jkn	5.00	LEGIT	LOW	2026-07-12 19:01:57+03	1.0.0	\N	Dar es Salaam	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	\N	\N	2026-07-12 19:01:57+03	\N	\N	0.00
167	TXN202607121812452003	4	\N	COSMA COSMA VICTORINI	\N	4000000.00	withdrawal	SUCCESS	jn,knolkn	3.00	LEGIT	LOW	2026-07-12 19:12:45+03	1.0.0	\N	Dar es Salaam	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	\N	\N	2026-07-12 19:12:45+03	\N	\N	0.00
168	TXN202607121827012026	4	\N	COSMA COSMA VICTORINI	\N	300000.00	withdrawal	SUCCESS	gfdhlkfs afsbk fdz,mvxn	5.00	LEGIT	LOW	2026-07-12 19:27:01+03	1.0.0	\N	Dar es Salaam	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	\N	\N	2026-07-12 19:27:01+03	\N	\N	0.00
169	TXN202607121832472615	4	\N	COSMA COSMA VICTORINI	\N	30000.00	withdrawal	SUCCESS	lekfndvkelfd	4.00	LEGIT	LOW	2026-07-12 19:32:47+03	1.0.0	\N	Dar es Salaam	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	\N	\N	2026-07-12 19:32:47+03	\N	\N	0.00
170	TXN202607121958091506	4	\N	COSMA COSMA VICTORINI	\N	30000.00	withdrawal	SUCCESS	lekfndvkelfd	4.00	LEGIT	LOW	2026-07-12 20:58:10+03	1.0.0	\N	Dar es Salaam	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	\N	\N	2026-07-12 20:59:01+03	\N	\N	0.00
171	TXN202607122008564312	4	\N	COSMA COSMA VICTORINI	\N	300000.00	withdrawal	ABORTED	BLOCKED: User has 3 consecutive failed withdrawal attempts | khftdsgdhfjkl	95.00	FRAUD	HIGH	\N	1.0.0	\N	Dar es Salaam	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	\N	\N	2026-07-12 21:08:56+03	\N	\N	0.00
172	TXN202607122038094258	4	5	COSMA COSMA VICTORINI	Christian Mahuve	40000.00	transfer	SUCCESS	luiytsdfghklj	9.00	LEGIT	LOW	2026-07-12 21:38:09+03	1.0.0	\N	Dar es Salaam	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	\N	\N	2026-07-12 21:39:51+03	\N	\N	0.00
173	TXN202607122040242875	4	18	COSMA COSMA VICTORINI	COSMA COSMA VICTORINE	40000.00	transfer	SUCCESS	kuyhfdfgfjkhlj	11.00	LEGIT	LOW	2026-07-12 21:40:24+03	1.0.0	\N	Dar es Salaam	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	\N	\N	2026-07-12 21:42:06+03	\N	\N	0.00
174	TXN202607122056252912	4	18	COSMA COSMA VICTORINI	COSMA COSMA VICTORINE	40000.00	transfer	SUCCESS	kuyhfdfgfjkhlj	9.00	LEGIT	LOW	2026-07-12 21:56:25+03	1.0.0	\N	Dar es Salaam	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	\N	\N	2026-07-12 21:58:07+03	\N	\N	0.00
175	TXN202607122058282074	4	12	COSMA COSMA VICTORINI	Fraud Receiver 1	40000.00	transfer	SUCCESS	kkhgfdghklj	11.00	LEGIT	LOW	2026-07-12 21:58:28+03	1.0.0	\N	Dar es Salaam	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	\N	\N	2026-07-12 22:00:10+03	\N	\N	0.00
176	TXN202607122100311395	4	13	COSMA COSMA VICTORINI	Fraud Receiver 2	40000.00	transfer	SUCCESS	iahukghgsdk	14.00	LEGIT	LOW	2026-07-12 22:00:31+03	1.0.0	\N	Dar es Salaam	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	\N	\N	2026-07-12 22:02:13+03	\N	\N	0.00
177	TXN202607122134242675	4	5	COSMA COSMA VICTORINI	Christian Mahuve	2000.00	transfer	SUCCESS	dxhbxtd	8.00	LEGIT	LOW	2026-07-12 22:34:24+03	1.0.0	\N	Dar es Salaam	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	\N	\N	2026-07-12 22:36:06+03	\N	\N	0.00
178	TXN202607122136264397	4	18	COSMA COSMA VICTORINI	COSMA COSMA VICTORINE	30000.00	transfer	SUCCESS	ghfxdfcgfh,	5.00	LEGIT	LOW	2026-07-12 22:36:26+03	1.0.0	\N	Dar es Salaam	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	\N	\N	2026-07-12 22:38:08+03	\N	\N	0.00
179	TXN202607122324388462	4	5	COSMA COSMA VICTORINI	Christian Mahuve	4000.00	transfer	SUCCESS	iuyfghjklj	11.00	LEGIT	LOW	2026-07-13 00:24:38+03	1.0.0	\N	Dar es Salaam	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	\N	\N	2026-07-13 00:25:29+03	\N	\N	0.00
180	TXN202607122325442737	4	18	COSMA COSMA VICTORINI	COSMA COSMA VICTORINE	4000.00	transfer	SUCCESS	uiytrdfhgkli;ukhf	11.00	LEGIT	LOW	2026-07-13 00:25:44+03	1.0.0	\N	Dar es Salaam	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	\N	\N	2026-07-13 00:26:35+03	\N	\N	0.00
181	TXN202607122326526572	4	12	COSMA COSMA VICTORINI	Fraud Receiver 1	4000.00	transfer	ABORTED	BLOCKED: User has 2 unique receivers in 5 minutes. Attempting to send to 3 (max: 3) | kdfgchklj	90.00	FRAUD	HIGH	\N	1.0.0	\N	Dar es Salaam	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	\N	\N	2026-07-13 00:26:52+03	\N	\N	0.00
182	TXN202607122335124832	4	12	COSMA COSMA VICTORINI	Fraud Receiver 1	4000.00	transfer	SUCCESS	kdfgchklj	11.00	LEGIT	LOW	2026-07-13 00:35:12+03	1.0.0	\N	Dar es Salaam	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	\N	\N	2026-07-13 00:36:03+03	\N	\N	0.00
183	TXN202607122339222360	4	5	COSMA COSMA VICTORINI	Christian Mahuve	4000.00	transfer	SUCCESS	;iuyfhdsfhgkl	11.00	LEGIT	LOW	2026-07-13 00:39:22+03	1.0.0	\N	Dar es Salaam	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	\N	\N	2026-07-13 00:40:13+03	\N	\N	0.00
184	TXN202607130002481474	4	18	COSMA COSMA VICTORINI	COSMA COSMA VICTORINE	30000.00	transfer	SUCCESS	ghfxdfcgfh,	0.00	LEGIT	LOW	\N	1.0.0	\N	Dar es Salaam	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	\N	\N	\N	2026-07-13 01:03:39+03	\N	\N	0.00
185	TXN202607130009595601	\N	4	\N	COSMA COSMA VICTORINI	10000000.00	deposit	SUCCESS	Admin adjustment: for testing	0.00	PENDING	LOW	\N	1.0.0	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	\N	\N	\N	2026-07-13 01:09:59+03	\N	\N	0.00
186	TXN202607130010201789	\N	4	\N	COSMA COSMA VICTORINI	10000000.00	deposit	SUCCESS	Admin adjustment: for testing	0.00	PENDING	LOW	\N	1.0.0	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	\N	\N	\N	2026-07-13 01:10:20+03	\N	\N	0.00
187	TXN202607130013568796	4	5	COSMA COSMA VICTORINI	Christian Mahuve	4000000.00	transfer	ABORTED	BLOCKED: Abnormal transaction at unusual hour with large amount | kkhgfdghjk	80.00	FRAUD	HIGH	\N	1.0.0	\N	Dar es Salaam	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	\N	\N	\N	2026-07-13 01:13:56+03	\N	\N	0.00
188	TXN202610301330501227	\N	\N	\N	FRANK GODWIN	2000000.00	deposit	SUCCESS	Admin adjustment: initial amount	0.00	\N	\N	\N	\N	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36	1	\N	\N	2026-10-30 13:30:50.017+03	\N	\N	0.00
189	TXN202610301403272510	\N	25	\N	FRANK GODWIN	2000000.00	deposit	SUCCESS	Admin adjustment: initial balance deposited	0.00	\N	\N	\N	\N	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36	1	\N	\N	2026-10-30 14:03:27.212+03	\N	\N	0.00
190	TXN202610301406238239	25	22	FRANK GODWIN	Baraka Mushi	70000.00	transfer	SUCCESS	pocket money	2.00	LEGIT	LOW	2026-10-30 14:06:24.383+03	1.0.0	{"amount": 70000, "balance": 2000000, "avg_user_amount": 0, "account_age_days": 0, "amount_deviation": 0, "amount_last_5min": 0, "transaction_hour": 14, "unique_senders_last_5min": 0, "unique_receivers_last_5min": 0, "transaction_count_last_5min": 0, "failed_withdrawals_last_10min": 0}	Dar es Salaam	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36	\N	\N	\N	2026-10-30 14:06:24.411005+03	\N	\N	0.00
191	TXN202610301417591112	19	20	Amina Hassan	Juma Mwangi	1000.00	transfer	SUCCESS	\N	3.00	LEGIT	LOW	2026-10-30 14:18:00.288+03	1.0.0	{"amount": 1000, "balance": 5000000, "avg_user_amount": 0, "account_age_days": 0, "amount_deviation": 0, "amount_last_5min": 0, "transaction_hour": 14, "unique_senders_last_5min": 0, "unique_receivers_last_5min": 0, "transaction_count_last_5min": 0, "failed_withdrawals_last_10min": 0}	Dar es Salaam	::1	curl/8.15.0	\N	\N	\N	2026-10-30 14:18:00.301119+03	\N	\N	0.00
192	TXN202610301418235787	\N	20	\N	Juma Mwangi	1500.00	deposit	SUCCESS	Admin adjustment: SMS delivery check	0.00	\N	\N	\N	\N	\N	\N	::1	curl/8.15.0	1	\N	\N	2026-10-30 14:18:23.972+03	\N	\N	0.00
193	TXN202610301420584267	25	22	FRANK GODWIN	Baraka Mushi	30000.00	transfer	SUCCESS	pocket money	2.00	LEGIT	LOW	2026-10-30 14:20:59.049+03	1.0.0	{"amount": 30000, "balance": 1930000, "avg_user_amount": 70000, "account_age_days": 0, "amount_deviation": -0.5714204082798817, "amount_last_5min": 0, "transaction_hour": 14, "unique_senders_last_5min": 0, "unique_receivers_last_5min": 0, "transaction_count_last_5min": 0, "failed_withdrawals_last_10min": 0}	Dar es Salaam	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36	\N	\N	\N	2026-10-30 14:20:59.057738+03	\N	\N	0.00
194	TXN202610301427088467	19	20	Amina Hassan	Juma Mwangi	500.00	transfer	SUCCESS	USSD transfer	3.00	LEGIT	LOW	2026-10-30 14:27:09.181+03	1.0.0	{"amount": 500, "balance": 4999000, "avg_user_amount": 1000, "account_age_days": 0, "amount_deviation": -0.4995004995004995, "amount_last_5min": 0, "transaction_hour": 14, "unique_senders_last_5min": 0, "unique_receivers_last_5min": 0, "transaction_count_last_5min": 0, "failed_withdrawals_last_10min": 0}	Dar es Salaam	197.250.224.160	curl/8.15.0	\N	\N	\N	2026-10-30 14:27:08.845028+03	\N	\N	0.00
195	TXN202610301537048686	23	21	Frank	Neema Joseph	50000.00	transfer	SUCCESS	pocket money	2.00	LEGIT	LOW	2026-10-30 15:37:04.863+03	1.0.0	{"amount": 50000, "balance": 1000000, "avg_user_amount": 0, "account_age_days": 0, "amount_deviation": 0, "amount_last_5min": 0, "transaction_hour": 15, "unique_senders_last_5min": 0, "unique_receivers_last_5min": 0, "transaction_count_last_5min": 0, "failed_withdrawals_last_10min": 0}	Dar es Salaam	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36	\N	\N	\N	2026-10-30 15:37:04.890855+03	\N	\N	400.00
196	TXN202610301542194236	23	25	Frank	FRANK GODWIN	4000.00	transfer	SUCCESS	premium fee	2.00	LEGIT	LOW	2026-10-30 15:42:20.058+03	1.0.0	{"amount": 4000, "balance": 949600, "avg_user_amount": 50000, "account_age_days": 0, "amount_deviation": -0.9199816003679926, "amount_last_5min": 0, "transaction_hour": 15, "unique_senders_last_5min": 0, "unique_receivers_last_5min": 0, "transaction_count_last_5min": 0, "failed_withdrawals_last_10min": 0}	Dar es Salaam	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36	\N	\N	\N	2026-10-30 15:42:20.065029+03	\N	\N	32.00
197	TXN202610301551134439	23	\N	Frank	\N	20000.00	withdrawal	SUCCESS	for use	2.00	LEGIT	LOW	2026-10-30 15:51:14.143+03	1.0.0	{"amount": 20000, "balance": 945568, "avg_user_amount": 27000, "account_age_days": 0, "amount_deviation": -0.25924965742009554, "amount_last_5min": 0, "transaction_hour": 15, "unique_senders_last_5min": 0, "unique_receivers_last_5min": 0, "transaction_count_last_5min": 0, "failed_withdrawals_last_10min": 0}	Dar es Salaam	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36	\N	\N	\N	2026-10-30 15:51:14.15867+03	-6.950000	39.220000	220.00
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, full_name, email, phone, card_number, password_hash, balance, security_answers, is_approved, is_active, reset_token, reset_token_expiry, last_known_location, location_updated_at, created_at, updated_at, transaction_pin_hash, pin_attempts, pin_locked_until, card_expiry, card_cvc, last_lat, last_lng) FROM stdin;
4	COSMA COSMA VICTORINI	godwinfranklin418@gmail.com	0757071967	4400000000000004	$2y$10$kgQf9nbzkYyap8qEN052DuqmWU7xehV3aRRNi4Q6hvcvmJxSzdYAq	22387000.00	\N	t	t	\N	\N	Dar es Salaam	\N	2026-05-13 23:37:52+03	2026-07-30 13:49:06+03	\N	0	\N	10/29	148	\N	\N
5	Christian Mahuve	godwinfranklin419@gmail.com	+255769010940	4400000000000005	$2y$10$kgQf9nbzkYyap8qEN052DuqmWU7xehV3aRRNi4Q6hvcvmJxSzdYAq	2160000.00	\N	t	t	\N	\N	Dar es Salaam	\N	2026-05-20 07:48:13+03	2026-07-30 13:49:13+03	\N	0	\N	10/29	185	\N	\N
6	Marie Curie	godwinfranklin415@gmail.com	+255767580650	4400000000000006	$2y$10$kgQf9nbzkYyap8qEN052DuqmWU7xehV3aRRNi4Q6hvcvmJxSzdYAq	600000.00	{"favorite_food": "$2y$10$/guJU4lDGk6z9lkQAqjVXOGbMrm/JXQwoYEowsDUtsuI/Mbjwra16", "primary_school": "$2y$10$yUJ1RdOCOqMC7XYS/XLiQOIRh7CTvgo0HKqK7PTxwzcTYZ4NQeuL.", "mother_full_name": "$2y$10$c9.GGSmZ6vJELpL8jMqr8.KU8T85Tcds90ch3ml9vFAjdNpUW08.."}	t	t	\N	\N	Dar es Salaam	\N	2026-06-19 08:34:21+03	2026-07-30 13:49:20+03	\N	0	\N	10/29	222	\N	\N
11	Fraud Test User	fraud_test@test.com	+255700000001	4400000000000011	$2y$10$kgQf9nbzkYyap8qEN052DuqmWU7xehV3aRRNi4Q6hvcvmJxSzdYAq	50000000.00	\N	t	t	\N	\N	Dar es Salaam	\N	2026-06-20 12:48:03+03	2026-07-30 13:49:35+03	\N	0	\N	10/29	407	\N	\N
12	Fraud Receiver 1	fraud_receiver_1@test.com	+255700000012	4400000000000012	$2y$10$FlAMgtY0NMs1HMWnV1R7Pu.vDMeULH5PqUg9V5PBp29bWwPStWGIO	1109000.00	\N	t	t	\N	\N	Dar es Salaam	\N	2026-06-20 12:48:03+03	2026-07-13 00:35:12+03	\N	0	\N	10/29	444	\N	\N
13	Fraud Receiver 2	fraud_receiver_2@test.com	+255700000002	4400000000000013	$2y$10$ThFlyY6CwdLoMdG/LzVnz.wBQ2hyYhZSTb5Qff0FtKX.2lhoElloi	1110000.00	\N	t	t	\N	\N	Dar es Salaam	\N	2026-06-20 12:48:03+03	2026-07-12 22:00:31+03	\N	0	\N	10/29	481	\N	\N
14	Fraud Receiver 3	fraud_receiver_3@test.com	+255700000003	4400000000000014	$2y$10$Nb/2KiknHtcA2Zdi8W4KDOvpV8ySE9NbF1tKV5tb4qFdxl3FPi/lK	1000000.00	\N	t	t	\N	\N	Dar es Salaam	\N	2026-06-20 12:48:03+03	2026-06-20 12:48:03+03	\N	0	\N	10/29	518	\N	\N
15	Fraud Receiver 4	fraud_receiver_4@test.com	+255700000004	4400000000000015	$2y$10$9Ge1n7D2eF.vEQIaYgmEfe4/syy.HFKI9tHCkJrrzsjxlAJaDBB/i	1000000.00	\N	t	t	\N	\N	Dar es Salaam	\N	2026-06-20 12:48:03+03	2026-06-20 12:48:03+03	\N	0	\N	10/29	555	\N	\N
16	Fraud Receiver 5	fraud_receiver_5@test.com	+255700000005	4400000000000016	$2y$10$zmEsXGfr1LSgWWCwBdMsE.1NLfd3XYs/13Z09Gu.vHylVzJrgP512	1000000.00	\N	t	t	\N	\N	Dar es Salaam	\N	2026-06-20 12:48:03+03	2026-06-20 12:48:03+03	\N	0	\N	10/29	592	\N	\N
17	Target User	target_user@test.com	+255700000099	4400000000000017	$2y$10$.0XUd.4NmsDX9xcbUqJL9ey.KNbXDNSHwzDBiHBvmcpOSA.PUhVUm	100000.00	\N	t	t	\N	\N	Dar es Salaam	\N	2026-06-20 12:48:04+03	2026-06-20 12:48:04+03	\N	0	\N	10/29	629	\N	\N
18	COSMA COSMA VICTORINE	godwinfranklin412@gmail.com	0765123456	4400000000000018	$2y$10$L9xmC0D0pwScp9Apa.i.Qu/VZfNfZ7HfL8QZUkjz4vdUG4WyZOFPG	15214000.00	{"favorite_food": "$2y$10$m/1c5oT07yndH1Jj00EpXODBjSupwwr8OLWgwCO/aL/tQ.1FjP.Zy", "primary_school": "$2y$10$GHcxAtiiX/mSk.Ohw.zt0.PDDxKGA8vuCAs21qtmdtXnrxkBoE6Sq", "mother_full_name": "$2y$10$mlDnjq6KtIeJZZ.wue.idO5YXJ6LAfGpJnT5B8iLzTtN1qIWKDxxa"}	t	t	\N	\N	Dar es Salaam	\N	2026-06-22 15:21:24+03	2026-07-13 01:02:48+03	\N	0	\N	10/29	666	\N	\N
20	Juma Mwangi	juma@example.com	+255700000020	4400000000000020	$2b$10$QlDHPKWun90/c.6HOEp5HOGIymQYAbJwMCWJ72HKT73zx79V85CJy	2503000.00	{"birth_city": "$2b$10$pmcWyS5yAJJrmKh7bfAXrOWWzlzRsMOEV9kK2AIf6JGHrRLKmy/d2", "first_school": "$2b$10$pmcWyS5yAJJrmKh7bfAXrOWWzlzRsMOEV9kK2AIf6JGHrRLKmy/d2", "mother_maiden": "$2b$10$pmcWyS5yAJJrmKh7bfAXrOWWzlzRsMOEV9kK2AIf6JGHrRLKmy/d2"}	t	t	\N	\N	Dar es Salaam	\N	2026-10-30 09:08:19+03	2026-10-30 14:27:08.845028+03	\N	0	\N	10/29	740	\N	\N
19	Amina Hassan	amina@example.com	+255700000019	4400000000000019	$2b$10$QlDHPKWun90/c.6HOEp5HOGIymQYAbJwMCWJ72HKT73zx79V85CJy	4998500.00	{"birth_city": "$2b$10$pmcWyS5yAJJrmKh7bfAXrOWWzlzRsMOEV9kK2AIf6JGHrRLKmy/d2", "first_school": "$2b$10$pmcWyS5yAJJrmKh7bfAXrOWWzlzRsMOEV9kK2AIf6JGHrRLKmy/d2", "mother_maiden": "$2b$10$pmcWyS5yAJJrmKh7bfAXrOWWzlzRsMOEV9kK2AIf6JGHrRLKmy/d2"}	t	t	\N	\N	Dar es Salaam	2026-10-30 14:27:08.845028+03	2026-10-30 09:08:19+03	2026-10-30 14:27:08.845028+03	$2b$10$X4r7AU6Pp9MyhOACjbZXV.fmbtNJLqb7JbiXNH.8PXhWE7k9qj2NS	0	\N	10/29	703	\N	\N
22	Baraka Mushi	baraka@example.com	+255700000022	4400000000000022	$2b$10$QlDHPKWun90/c.6HOEp5HOGIymQYAbJwMCWJ72HKT73zx79V85CJy	900000.00	{"birth_city": "$2b$10$pmcWyS5yAJJrmKh7bfAXrOWWzlzRsMOEV9kK2AIf6JGHrRLKmy/d2", "first_school": "$2b$10$pmcWyS5yAJJrmKh7bfAXrOWWzlzRsMOEV9kK2AIf6JGHrRLKmy/d2", "mother_maiden": "$2b$10$pmcWyS5yAJJrmKh7bfAXrOWWzlzRsMOEV9kK2AIf6JGHrRLKmy/d2"}	t	t	\N	\N	Dar es Salaam	\N	2026-10-30 09:08:19+03	2026-10-30 14:20:59.057738+03	\N	0	\N	10/29	814	\N	\N
23	Frank	frank@example.com	+255700000007	4485275742308327	$2b$10$2hW1Z5axIxhN9ouOO30aPuwDq3LcY3FqBwaSowjf/nG5yKpfgsTwu	925348.00	{"birth_city": "$2b$10$Wdfj6J34kHwjSA8BJKl6wefqeh0uMq.HrX16ZCDytqcq58b9S3wtS", "first_school": "$2b$10$Wdfj6J34kHwjSA8BJKl6wefqeh0uMq.HrX16ZCDytqcq58b9S3wtS", "mother_maiden": "$2b$10$Wdfj6J34kHwjSA8BJKl6wefqeh0uMq.HrX16ZCDytqcq58b9S3wtS"}	t	t	\N	\N	Dar es Salaam	2026-10-30 15:51:14.15867+03	2026-10-30 09:09:46+03	2026-10-30 15:51:14.15867+03	\N	0	\N	10/29	851	-6.950000	39.220000
25	FRANK GODWIN	godwinfranklin411@gmail.com	+255616675940	4400000000000025	$2b$10$lASn7MKcZJip/NPk8mszgeCY.Yyc9J492.k/ldXu.pyogp9GckWAW	1904000.00	\N	t	t	\N	\N	Dar es Salaam	2026-10-30 14:20:59.057738+03	2026-10-30 14:01:29.293009+03	2026-10-30 15:42:20.065029+03	$2b$10$yDplXHf08WIyeBNAoGuYBu30D/cAxS6XOMi0m7AUx94as38JB9Jee	0	\N	10/29	925	\N	\N
21	Neema Joseph	neema@example.com	+255700000021	4400000000000021	$2b$10$QlDHPKWun90/c.6HOEp5HOGIymQYAbJwMCWJ72HKT73zx79V85CJy	12050000.00	{"birth_city": "$2b$10$pmcWyS5yAJJrmKh7bfAXrOWWzlzRsMOEV9kK2AIf6JGHrRLKmy/d2", "first_school": "$2b$10$pmcWyS5yAJJrmKh7bfAXrOWWzlzRsMOEV9kK2AIf6JGHrRLKmy/d2", "mother_maiden": "$2b$10$pmcWyS5yAJJrmKh7bfAXrOWWzlzRsMOEV9kK2AIf6JGHrRLKmy/d2"}	t	t	\N	\N	Dar es Salaam	\N	2026-10-30 09:08:19+03	2026-10-30 15:37:04.890855+03	\N	0	\N	10/29	777	\N	\N
\.


--
-- Data for Name: ussd_requests; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ussd_requests (id, session_id, phone, text_hash, text, response, is_end, scene, actor_kind, actor_id, ip_address, duration_ms, created_at) FROM stdin;
1	live-unknown-1	+255799999999	fc9a09f2dcfca18a4bc966a91e39b51e3cc964e11913b0c801b27804cc80cccd		CON WELCOME\n1. Register\n2. About\n0. Exit	f	guest.main	\N	\N	::1	32	2026-10-30 10:06:32+03
2	live-user-1	+255769010940	4cac89b36ae71935627e19ef17bcc8e826c676463bf1168f4f197cb6c366760d		CON Welcome Christian\n1. My Account\n2. Send Money\n3. Withdraw\n4. Transactions\n5. Balance\n6. Profile\n7. Help\n0. Exit	f	user.main	user	5	::1	15	2026-10-30 10:06:33+03
3	live-user-1	+255769010940	d09ea3768474f25e772644a43116e7671198b94db3ef88e3841ccbbfb3c0811e	5	CON AVAILABLE BALANCE\nTSh 2,160,000\nCurrency TZS\n0. Back	f	user.main	user	5	::1	17	2026-10-30 10:06:33+03
4	verify-1	+255700000001	be16a0f97067a3569a8d795fa75353590fd92c34d2afa7becf7bdbed485b531a		CON Welcome Fraud\n1. My Account\n2. Send Money\n3. Withdraw\n4. Transactions\n5. Balance\n6. Profile\n7. Help\n0. Exit	f	user.main	user	11	197.250.50.236	101	2026-10-30 10:56:06+03
5	verify-2	+255700000001	b98961e4f5ab7a09bf8ca1aed879d9014a34fa274a078b47605e4f01d2d7bb53		CON Welcome Fraud\n1. My Account\n2. Send Money\n3. Withdraw\n4. Transactions\n5. Balance\n6. Profile\n7. Help\n0. Exit	f	user.main	user	11	197.250.224.160	65	2026-10-30 11:03:09+03
6	verify-3	+255700000001	91fc3d82e47f798b069371dd6a89f5bdac6c547c56d272e9c8f4d60d73854d57		CON Welcome Fraud\n1. My Account\n2. Send Money\n3. Withdraw\n4. Transactions\n5. Balance\n6. Profile\n7. Help\n0. Exit	f	user.main	user	11	197.250.224.160	75	2026-10-30 11:08:11+03
7	pub-verify-1	+255700000001	55380d4c2daf357029a39cb3b32624831a7079f8670a6f4e6b20feb1ce7f7733		CON Welcome Fraud\n1. My Account\n2. Send Money\n3. Withdraw\n4. Transactions\n5. Balance\n6. Profile\n7. Help\n0. Exit	f	user.main	user	11	197.250.224.160	38	2026-10-30 11:21:23+03
8	pub-verify-1793348491	+255700000001	16e76db1cdef5bfb2fc17b097a2bf1bf480af4a437704ff90c2475b8afd1286b		CON Welcome Fraud\n1. My Account\n2. Send Money\n3. Withdraw\n4. Transactions\n5. Balance\n6. Profile\n7. Help\n0. Exit	f	user.main	user	11	197.250.224.160	41	2026-10-30 11:21:33+03
9	pub-verify-1793348491	+255700000001	dcf9aa632347949777051c2b05f15cacea8e61abb4ea1bbdcfd0290f114b3e10	1	CON MY ACCOUNT\nFraud Test User\n+255700000001\nACTIVE\nJoined 20/06 12:48\n0. Back	f	user.main	user	11	197.250.224.160	162	2026-10-30 11:21:34+03
10	pub-bal-1793348504	+255700000001	f2eed478abf0755c9b668f46dc05ef79ff0e653c8781b5850c4336b071c4780b		CON Welcome Fraud\n1. My Account\n2. Send Money\n3. Withdraw\n4. Transactions\n5. Balance\n6. Profile\n7. Help\n0. Exit	f	user.main	user	11	197.250.224.160	22	2026-10-30 11:21:46+03
11	pub-bal-1793348504	+255700000001	4dac55053890534dbd9f2cee8e149cd49af7297bde51cb29854018deca3b09c2	5	CON AVAILABLE BALANCE\nTSh 50,000,000\nCurrency TZS\n0. Back	f	user.main	user	11	197.250.224.160	23	2026-10-30 11:21:48+03
12	tok-check	+255700000001	0455975e38c52deff91c8461eb376b87aecf64a8521a0377aa9481edc2904686		CON Welcome Fraud\n1. My Account\n2. Send Money\n3. Withdraw\n4. Transactions\n5. Balance\n6. Profile\n7. Help\n0. Exit	f	user.main	user	11	197.250.224.160	13	2026-10-30 11:29:52+03
13	ATUid_5dab848697941322f795505f9b3e1a9a	+255616675940	339efdd8dc44009bcce07b37165e801a85315a837bab20d58e3dbe9ff2363309		CON WELCOME\n1. Register\n2. About\n0. Exit	f	guest.main	\N	\N	18.133.205.228	84	2026-10-30 11:55:02+03
14	ATUid_5dab848697941322f795505f9b3e1a9a	+255616675940	b926efc9e55ca8681854907d3444da33dee39edbf5d425e8b22b93cfef772791	1	CON REGISTER 1/4\nEnter full name\n0. Cancel	f	guest.main	\N	\N	18.133.205.228	41	2026-10-30 11:55:28+03
15	smoke-1793350528	+255700000001	92f22c404d8a82b54b66e6a8a55f539dbedece0b738c10583ffdff876d611a21		CON Welcome Fraud\n1. My Account\n2. Send Money\n3. Withdraw\n4. Transactions\n5. Balance\n6. Profile\n7. Help\n0. Exit	f	user.main	user	11	197.250.224.160	19	2026-10-30 11:55:29+03
16	ATUid_5dab848697941322f795505f9b3e1a9a	+255616675940	79e62bd0b24d189730eebe7d8cd735fa412214f543fbdbbf6853efb95b343a19	1*FRANK GODWIN	CON REGISTER 2/4\nEnter email address\n0. Cancel	f	guest.reg.name	\N	\N	18.133.205.228	229	2026-10-30 11:55:40+03
17	ATUid_5dab848697941322f795505f9b3e1a9a	+255616675940	9da683e1d267465e4df78bdfc27d52c87208aa4353e3e83674cb3e0f9d0f628f	1*FRANK GODWIN*godwinfranklin411@gmail.com	CON REGISTER 3/4\nEnter 16-digit card no.\n0. Cancel	f	guest.reg.email	\N	\N	18.133.205.228	21	2026-10-30 11:56:00+03
18	ATUid_d0866a8b8766a1513976103b4d994824	+255616675940	65c75e7a938ccbeeddb41a059368879ddfb1e7274c5f163788ebe2eed2350bb2		CON WELCOME\n1. Register\n2. About\n0. Exit	f	guest.main	\N	\N	18.133.205.228	13	2026-10-30 11:56:26+03
19	ATUid_d0866a8b8766a1513976103b4d994824	+255616675940	587f176c100be46fddeb8875c1d63b48dc8bb56b9a98ddef1acbabf7814ed9c8	1	CON REGISTER 1/4\nEnter full name\n0. Cancel	f	guest.main	\N	\N	18.133.205.228	12	2026-10-30 11:56:34+03
20	ATUid_d0866a8b8766a1513976103b4d994824	+255616675940	f1f89b2f359b7d4dc7757617211437ecdba1b6a6719d613999cf9b36eb183c69	1*FRANK GODWIN	CON REGISTER 2/4\nEnter email address\n0. Cancel	f	guest.reg.name	\N	\N	18.133.205.228	11	2026-10-30 11:56:48+03
21	ATUid_d0866a8b8766a1513976103b4d994824	+255616675940	c23efb29aa27d4df78de0bfc62299a15a960d4f0d3f90d814e8b8f57aa061bb7	1*FRANK GODWIN*godwinfranklin411@gmail.com	CON REGISTER 3/4\nEnter 16-digit card no.\n0. Cancel	f	guest.reg.email	\N	\N	18.133.205.228	17	2026-10-30 11:56:56+03
22	ATUid_d0866a8b8766a1513976103b4d994824	+255616675940	64d6ee904769d2c2ce5646aaaf3d029a8f2c3f199782fd3bf3fd41d34d1a279a	1*FRANK GODWIN*godwinfranklin411@gmail.com*3245673897654327	CON REGISTER 4/4\nSet 4-digit PIN\n0. Cancel	f	guest.reg.card	\N	\N	18.133.205.228	18	2026-10-30 11:57:06+03
23	ATUid_d0866a8b8766a1513976103b4d994824	+255616675940	d8ff4a0be116ad75dd62e24e566a654d0265856afa5fc0397ba45fc0f1bf42a7	1*FRANK GODWIN*godwinfranklin411@gmail.com*3245673897654327****	CON Confirm your PIN\n0. Cancel	f	guest.reg.pin	\N	\N	18.133.205.228	167	2026-10-30 11:57:14+03
24	ATUid_d0866a8b8766a1513976103b4d994824	+255616675940	93d5b1427f57a17a8816b94f1ef3d22add189969a70947a11fafd27c7b1add66	1*FRANK GODWIN*godwinfranklin411@gmail.com*3245673897654327*6549****	CON CONFIRM DETAILS\nFRANK GODWIN\ngodwinfranklin411@gmail.com\n+255616675940\nCard ****4327\n1. Submit  0. Cancel	f	guest.reg.pinConfirm	\N	\N	18.133.205.228	151	2026-10-30 11:57:24+03
25	ATUid_a010a361850c82bd51d2c63746f16c5e	+255616675940	48db602e98271ddfa548c34acf812af13ff58e3b68d5ba926ca60522dea342df		CON WELCOME\n1. Register\n2. About\n0. Exit	f	guest.main	\N	\N	18.133.205.228	10	2026-10-30 11:57:51+03
26	ATUid_a010a361850c82bd51d2c63746f16c5e	+255616675940	34ecba673ce6e9299aad8bca4ae96815b4a4c375c53a4a6e1163a503a9ed8cd9	1	CON REGISTER 1/4\nEnter full name\n0. Cancel	f	guest.main	\N	\N	18.133.205.228	7	2026-10-30 11:57:56+03
27	ATUid_a010a361850c82bd51d2c63746f16c5e	+255616675940	326842faa8431013b0937db9a7406ab7e290145c58c49cbff29304cf05d3fee3	1*FRANK GODWIN	CON REGISTER 2/4\nEnter email address\n0. Cancel	f	guest.reg.name	\N	\N	18.133.205.228	11	2026-10-30 11:58:06+03
28	ATUid_a010a361850c82bd51d2c63746f16c5e	+255616675940	9733b665f2809957d15ed5934f73a511245a3cb587ec30ae55be3e3063298492	1*FRANK GODWIN*godwinfranklin411@gmail.com	CON REGISTER 3/4\nEnter 16-digit card no.\n0. Cancel	f	guest.reg.email	\N	\N	18.133.205.228	15	2026-10-30 11:58:15+03
29	ATUid_a010a361850c82bd51d2c63746f16c5e	+255616675940	bd04ae7244b4a112c0343c767c7111afd2aa1f1292fd57be917b4a949211c637	1*FRANK GODWIN*godwinfranklin411@gmail.com*4532786543267865	CON REGISTER 4/4\nSet 4-digit PIN\n0. Cancel	f	guest.reg.card	\N	\N	18.133.205.228	13	2026-10-30 11:58:25+03
30	ATUid_7ece454f4d797dbac65bde6bd4895360	+255616675940	afc91a9f08f99f81beb90296f85e60a8d3c983ab762daff847188805fd213339		CON WELCOME\n1. Register\n2. About\n0. Exit	f	guest.main	\N	\N	18.133.205.228	12	2026-10-30 12:02:21+03
31	ATUid_7ece454f4d797dbac65bde6bd4895360	+255616675940	4a63ba6b7707c432264f9f9fc6ef5986ffd4c113e096c781986fd2809b8482d8	1	CON REGISTER 1/4\nEnter full name\n0. Cancel	f	guest.main	\N	\N	18.133.205.228	16	2026-10-30 12:02:28+03
32	ATUid_7ece454f4d797dbac65bde6bd4895360	+255616675940	0552ab231019e4a07c0a018659c2eba5449973af6be3276a5b8b8f6acb5a70c9	1*FRANK GODWIN	CON REGISTER 2/4\nEnter email address\n0. Cancel	f	guest.reg.name	\N	\N	18.133.205.228	8	2026-10-30 12:02:39+03
33	ATUid_7ece454f4d797dbac65bde6bd4895360	+255616675940	ee91dcb5d63b9fa96fece70c301c303ee8555fe5ae7928f177b7a36c72a05c49	1*FRANK GODWIN*godwinfranklin411@gmail.com	CON REGISTER 3/4\nEnter 16-digit card no.\n0. Cancel	f	guest.reg.email	\N	\N	18.133.205.228	10	2026-10-30 12:02:47+03
34	ATUid_7ece454f4d797dbac65bde6bd4895360	+255616675940	9d72c0f002a7d267f45bf7735443d952c436d0a6d7512de7c6eb5cf40e2c6f2a	1*FRANK GODWIN*godwinfranklin411@gmail.com*5647893452675345	CON REGISTER 4/4\nSet 4-digit PIN\n0. Cancel	f	guest.reg.card	\N	\N	18.133.205.228	10	2026-10-30 12:02:59+03
35	ATUid_7ece454f4d797dbac65bde6bd4895360	+255616675940	76ed057809ef4545c5874d8c31efd9453040130da02ade72aa75c0ec0ce38433	1*FRANK GODWIN*godwinfranklin411@gmail.com*5647893452675345****	CON Confirm your PIN\n0. Cancel	f	guest.reg.pin	\N	\N	18.133.205.228	156	2026-10-30 12:03:04+03
36	ATUid_7ece454f4d797dbac65bde6bd4895360	+255616675940	b39c2b50d6941b9db2ebc9e9a21f5ab5ec4187cf784e3e988415f206dcfa0f31	1*FRANK GODWIN*godwinfranklin411@gmail.com*5647893452675345*6549****	CON CONFIRM DETAILS\nFRANK GODWIN\ngodwinfranklin411@gmail.com\n+255616675940\nCard ****5345\n1. Submit  0. Cancel	f	guest.reg.pinConfirm	\N	\N	18.133.205.228	149	2026-10-30 12:03:09+03
37	ATUid_7ece454f4d797dbac65bde6bd4895360	+255616675940	0cf071fb397526abf4c9da813473925718ab1a59d1b05375d8d582c3009863de	1*FRANK GODWIN*godwinfranklin411@gmail.com*5647893452675345*6549*6549*1	END REGISTRATION SUBMITTED\nYour account is pending\nadmin approval. You will be\nable to transact once it is\napproved.	t	guest.reg.review	\N	\N	18.133.205.228	175	2026-10-30 12:03:14+03
38	ATUid_7e162098bc97098a1a0852d2bd0c6f91	+255616675940	ac9889610463f8830fafc48b3d95ece1f5741b2d21812cd7a2bc93f10ec5cacf		CON Welcome FRANK\n1. My Account\n2. Send Money\n3. Withdraw\n4. Transactions\n5. Balance\n6. Profile\n7. Help\n0. Exit	f	user.main	user	24	18.133.205.228	10	2026-10-30 12:04:22+03
39	ATUid_7e162098bc97098a1a0852d2bd0c6f91	+255616675940	58d69a440681e05c0caf5daf9bd2528f084010a93dc626e346da83e8aed1479a	1	CON MY ACCOUNT\nFRANK GODWIN\n+255616675940\nACTIVE\nJoined 30/10 12:03\n0. Back	f	user.main	user	24	18.133.205.228	60	2026-10-30 12:05:06+03
40	ATUid_7e162098bc97098a1a0852d2bd0c6f91	+255616675940	8fe939d39a0049e3bcd36f097c91c12a7a0fffa0f8091a0a21d281dedca2d6c5	1*0	CON Welcome FRANK\n1. My Account\n2. Send Money\n3. Withdraw\n4. Transactions\n5. Balance\n6. Profile\n7. Help\n0. Exit	f	user.main	user	24	18.133.205.228	16	2026-10-30 12:05:15+03
41	ATUid_7e162098bc97098a1a0852d2bd0c6f91	+255616675940	caa4402e38d2d1e04458e700be984054121c48849711bb0bd44e647082c72ca5	1*0*2	CON SEND MONEY\nEnter recipient phone\n0. Back	f	user.main	user	24	18.133.205.228	13	2026-10-30 12:05:20+03
42	ATUid_0f204186c5d379992cb5a252bdcb6e9f	+255616675940	e869171afe47d44792bb877236ebdbe7c6b01d9d6574c33428b19f4cd5934ecc		CON Welcome FRANK\n1. My Account\n2. Send Money\n3. Withdraw\n4. Transactions\n5. Balance\n6. Profile\n7. Help\n0. Exit	f	user.main	user	24	18.133.205.228	13	2026-10-30 12:05:32+03
43	ATUid_0f204186c5d379992cb5a252bdcb6e9f	+255616675940	82b6b4e9d42ad1ac8ec1445fda368d42c88ef3874dae71f1cf3f86bc361903f9	3	CON WITHDRAW\nAvailable TSh 0\nEnter amount\n0. Back	f	user.main	user	24	18.133.205.228	27	2026-10-30 12:05:39+03
44	ATUid_0f204186c5d379992cb5a252bdcb6e9f	+255616675940	be66c9659b01dc03c3bf7e1f3a4d1808046f23db4017095852e037b93e99f9ac	3*100	CON Minimum withdrawal is TSh 1,000.\nWITHDRAW\nAvailable TSh 0\nEnter amount\n0. Back	f	user.withdraw.amount	user	24	18.133.205.228	21	2026-10-30 12:05:44+03
45	ATUid_0f204186c5d379992cb5a252bdcb6e9f	+255616675940	981cdd5b78168fbc9c47c5b9c2d52dd9518264edc89e5e6b0853785d4a72463f	3*100*0	CON Welcome FRANK\n1. My Account\n2. Send Money\n3. Withdraw\n4. Transactions\n5. Balance\n6. Profile\n7. Help\n0. Exit	f	user.main	user	24	18.133.205.228	14	2026-10-30 12:05:56+03
46	ATUid_0f204186c5d379992cb5a252bdcb6e9f	+255616675940	e0397cf032275b2ad2392ce4e3019b4ee76fc25b654e88fa7cdd63ead59393c7	3*100*0*5	CON AVAILABLE BALANCE\nTSh 0\nCurrency TZS\n0. Back	f	user.main	user	24	18.133.205.228	10	2026-10-30 12:06:01+03
47	ATUid_0f204186c5d379992cb5a252bdcb6e9f	+255616675940	0ed4eef933fe2634867c813ec4b6073c24cf9c2ccede4680f6c8bc5c1f7e6e17	3*100*0*5*0	CON Welcome FRANK\n1. My Account\n2. Send Money\n3. Withdraw\n4. Transactions\n5. Balance\n6. Profile\n7. Help\n0. Exit	f	user.main	user	24	18.133.205.228	20	2026-10-30 12:06:13+03
48	ATUid_0f204186c5d379992cb5a252bdcb6e9f	+255616675940	09fde259b06931d1cccf057c2cf8097394f8e83eff22d164a9dda68a1b3b4f3b	3*100*0*5*0*4	CON TRANSACTIONS\n1. Latest\n2. Search by ref\n0. Back	f	user.main	user	24	18.133.205.228	26	2026-10-30 12:06:19+03
49	verify-1793354546	+255700000001	ba26c64962dae2125a35a4fc782363f1a1246f641cb661428afa1dcc52030f92		CON Welcome Fraud\n1. My Account\n2. Send Money\n3. Withdraw\n4. Transactions\n5. Balance\n6. Profile\n7. Help\n0. Exit	f	user.main	user	11	197.250.224.160	75	2026-10-30 13:02:28.469+03
50	verifyb-1793354549	+255700000019	f31f79c06c423026ea5c298813161dc7ee9278a31a2fe30adea04787f90c1107	5	CON Welcome Amina\n1. My Account\n2. Send Money\n3. Withdraw\n4. Transactions\n5. Balance\n6. Profile\n7. Help\n0. Exit	f	user.main	user	19	197.250.224.160	14	2026-10-30 13:02:30.509+03
51	flow-1793354573	+255700000019	aca648bfbf4163d5b276082091c287627c8a17f50ac4356194e82bbfb169d31e		CON Welcome Amina\n1. My Account\n2. Send Money\n3. Withdraw\n4. Transactions\n5. Balance\n6. Profile\n7. Help\n0. Exit	f	user.main	user	19	197.250.224.160	36	2026-10-30 13:02:55.05+03
52	flow-1793354573	+255700000019	78047b9ecffdd82c493741194852b55e32abecb47c9b1991f30295183e2524d8	5	CON AVAILABLE BALANCE\nTSh 5,000,000\nCurrency TZS\n0. Back	f	user.main	user	19	197.250.224.160	15	2026-10-30 13:02:56.859+03
53	flow-1793354573	+255700000019	3ee7ab423bc723f8b72b608f411d84e2d1e24da601bc4b0ebf74cd3219067678	5*0	CON Welcome Amina\n1. My Account\n2. Send Money\n3. Withdraw\n4. Transactions\n5. Balance\n6. Profile\n7. Help\n0. Exit	f	user.main	user	19	197.250.224.160	13	2026-10-30 13:02:58.6+03
54	final-1793354878	+255700000019	71c1ee65ccbc9dd15a575e74d9d614af32c96b8d1fa1bec322643995e93bdebb	5	CON Welcome Amina\n1. My Account\n2. Send Money\n3. Withdraw\n4. Transactions\n5. Balance\n6. Profile\n7. Help\n0. Exit	f	user.main	user	19	197.250.224.160	72	2026-10-30 13:08:00.192+03
55	sms-1793355657	+255700000019	17d0659e5b51127d5183f2be957dcc49d0f9c5532cc7ad8edbc10328b7289c53		CON Welcome Amina\n1. My Account\n2. Send Money\n3. Withdraw\n4. Transactions\n5. Balance\n6. Profile\n7. Help\n0. Exit	f	user.main	user	19	197.250.224.160	61	2026-10-30 13:20:58.991+03
56	v-1793357480	+255700000019	3361a7b953a2f59ca8707209f777dcbc8d8a54b8e70a4cb2c996b5fb7b0e7d72		CON Welcome Amina\n1. My Account\n2. Send Money\n3. Withdraw\n4. Transactions\n5. Balance\n6. Profile\n7. Help\n0. Exit	f	user.main	user	19	197.250.224.160	60	2026-10-30 13:51:22.204+03
57	ATUid_3a604ce961ce03921f3ce5653a7e6bd7	+255616675940	9c1ec992986cfdcf2e51bead28d51d75a7ac29e0f8fe000e4381ed14fd2d208f		CON WELCOME\n1. Register\n2. About\n0. Exit	f	guest.main	\N	\N	18.133.205.228	97	2026-10-30 14:00:26.029+03
58	ATUid_32725714414ccf5c3cfdfc1b2e10f0ea	+255616675940	1d512321516b6b188482cdee545c9dfd7332c0b38b1aa50cd197110ff5825b1f		CON WELCOME\n1. Register\n2. About\n0. Exit	f	guest.main	\N	\N	18.133.205.228	17	2026-10-30 14:00:36.118+03
59	ATUid_32725714414ccf5c3cfdfc1b2e10f0ea	+255616675940	1360d029fbe6a0e0c0dbbd8ad02e37deca6b78c8f164f6528aa38a65bac9fe97	1	CON REGISTER 1/4\nEnter full name\n0. Cancel	f	guest.main	\N	\N	18.133.205.228	24	2026-10-30 14:00:39.496+03
60	ATUid_32725714414ccf5c3cfdfc1b2e10f0ea	+255616675940	2a5ae7c77775390971044e2152d08b2178d5eb5a2f10e3f0328ba86b1e197274	1*FRANK GODWIN	CON REGISTER 2/4\nEnter email address\n0. Cancel	f	guest.reg.name	\N	\N	18.133.205.228	15	2026-10-30 14:00:49.209+03
61	ATUid_32725714414ccf5c3cfdfc1b2e10f0ea	+255616675940	4f983878d04eb13f9e1e0fa01951e8546cdbec0bfbc2b7b61f7a136f6dba767d	1*FRANK GODWIN*godwinfranklin411@gmail.com	CON REGISTER 3/4\nEnter 16-digit card no.\n0. Cancel	f	guest.reg.email	\N	\N	18.133.205.228	35	2026-10-30 14:01:02.475+03
62	ATUid_32725714414ccf5c3cfdfc1b2e10f0ea	+255616675940	58e01b5f9d12cb32bd04db92901692e822b8ee4cf9e0b3c747826e1a406c8b3b	1*FRANK GODWIN*godwinfranklin411@gmail.com*6542315385935163	CON REGISTER 4/4\nSet 4-digit PIN\n0. Cancel	f	guest.reg.card	\N	\N	18.133.205.228	33	2026-10-30 14:01:12.833+03
63	ATUid_32725714414ccf5c3cfdfc1b2e10f0ea	+255616675940	3c560f5ea7f01f322c1d585235c2bdeb6365ab598240d5027c2c54106c79ee13	1*FRANK GODWIN*godwinfranklin411@gmail.com*6542315385935163****	CON Confirm your PIN\n0. Cancel	f	guest.reg.pin	\N	\N	18.133.205.228	251	2026-10-30 14:01:18.856+03
64	ATUid_32725714414ccf5c3cfdfc1b2e10f0ea	+255616675940	65fca120c84e10e55ac514953a46523a777baec7e67eca808033074c1c7bb7ad	1*FRANK GODWIN*godwinfranklin411@gmail.com*6542315385935163*6549****	CON CONFIRM DETAILS\nFRANK GODWIN\ngodwinfranklin411@gmail.com\n+255616675940\nCard ****5163\n1. Submit  0. Cancel	f	guest.reg.pinConfirm	\N	\N	18.133.205.228	161	2026-10-30 14:01:24.91+03
65	ATUid_32725714414ccf5c3cfdfc1b2e10f0ea	+255616675940	7d91f344ad18e4f7dd33f9fa8d66b03b62c59d825e9d7b5f8fa1762bbf96ff6f	1*FRANK GODWIN*godwinfranklin411@gmail.com*6542315385935163*6549*6549*1	END REGISTRATION SUBMITTED\nYour account is pending\nadmin approval. You will be\nable to transact once it is\napproved.\nWeb password: your phone\nnumber. Change it on the…	t	guest.reg.review	\N	\N	18.133.205.228	198	2026-10-30 14:01:29.292+03
66	ATUid_014e8a928f23a1a8ec4ddac74b475e52	+255616675940	8d44bbec24d80f2614352cbded24e8055bd07f92f133cc89b65a086be8324e91		CON Welcome FRANK\n1. My Account\n2. Send Money\n3. Withdraw\n4. Transactions\n5. Balance\n6. Profile\n7. Help\n0. Exit	f	user.main	user	25	18.133.205.228	38	2026-10-30 14:02:39.762+03
67	smscheck-1793359615	+255700000019	784240743af12ecbe72cfe38f7336526a38e1c5660967cb3890e38f0668222aa		CON Welcome Amina\n1. My Account\n2. Send Money\n3. Withdraw\n4. Transactions\n5. Balance\n6. Profile\n7. Help\n0. Exit	f	user.main	user	19	197.250.224.160	60	2026-10-30 14:26:57.088+03
68	smscheck-1793359615	+255700000019	daf3de3aa159408e4ea2950ca535723044d6d74efb9ec43ea5f4f2ae63347e6c	2	CON SEND MONEY\nEnter recipient phone\n0. Back	f	user.main	user	19	197.250.224.160	19	2026-10-30 14:26:58.972+03
69	smscheck-1793359615	+255700000019	4067e8ed164f96835bd24542ea9f0960f24a73347d493f1fe4b79273a2b377fa	2*+255700000020	CON To Juma Mwangi\n+255700000020\nEnter amount (TSh)\n0. Back	f	user.send.phone	user	19	197.250.224.160	13	2026-10-30 14:27:00.629+03
70	smscheck-1793359615	+255700000019	67d6acfbe58bac13677046ddadca6d0a1724721b90433d614650c18db311b546	2*+255700000020*500	CON SEND TSh 500 to Juma Mwangi\nPIN required\n1. Set PIN\n0. Cancel	f	user.send.amount	user	19	197.250.224.160	16	2026-10-30 14:27:02.127+03
71	smscheck-1793359615	+255700000019	d8c0e14278f3389bb60dda6258fe09bd806a0d8a7f0c0b8416251a807e15d374	2*+255700000020*500****	CON Set transaction PIN\nEnter 4-digit PIN\n0. Cancel	f	user.send.pin	user	19	197.250.224.160	11	2026-10-30 14:27:03.623+03
72	smscheck-1793359615	+255700000019	5f1009f90ff8be0fd8f6e8fb4a26771accc1a73474a9cd9eea0d17fea5bd97d1	2*+255700000020*500*1****	CON Confirm your new PIN	f	pin.new	user	19	197.250.224.160	171	2026-10-30 14:27:05.241+03
73	smscheck-1793359615	+255700000019	17c67611ae0325cc5411edbcaaa8679637f7039e42045622449d1cb03c8b165a	2*+255700000020*500*1*4321****	CON PIN set.\nSend TSh 500 to Juma Mwangi\nEnter 4-digit PIN	f	pin.confirm	user	19	197.250.224.160	167	2026-10-30 14:27:07.045+03
74	smscheck-1793359615	+255700000019	1de3cd23f92b8c87071383057cd6ed1cbe4cd86b3d7b2e014a8b231e22f5c2dc	2*+255700000020*500*1*4321*4321****	END Sent TSh 500 to Juma Mwangi\nRef TXN202610301427088467\nRisk 3% LOW	t	user.send.pin	user	19	197.250.224.160	490	2026-10-30 14:27:08.844+03
\.


--
-- Data for Name: ussd_security_events; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ussd_security_events (id, event_type, phone, session_id, detail, ip_address, created_at) FROM stdin;
1	CALLBACK_CONTINUITY_VIOLATION	+255700000001	pub-verify-1793348491	text does not extend the previous input	197.250.224.160	2026-10-30 11:21:36+03
\.


--
-- Data for Name: ussd_sessions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ussd_sessions (id, phone, actor_kind, actor_id, state, last_text, created_at, updated_at, expires_at) FROM stdin;
ATUid_0f204186c5d379992cb5a252bdcb6e9f	+255616675940	user	24	{"data": {"page": "1"}, "scene": "user.tx.menu", "stack": ["user.main"]}	3*100*0*5*0*4	2026-10-30 12:05:32+03	2026-10-30 12:06:19+03	2026-10-30 09:09:19+03
ATUid_5dab848697941322f795505f9b3e1a9a	+255616675940	\N	\N	{"data": {"name": "FRANK GODWIN", "email": "godwinfranklin411@gmail.com"}, "scene": "guest.reg.card", "stack": ["guest.main", "guest.reg.name", "guest.reg.email"]}	1*FRANK GODWIN*godwinfranklin411@gmail.com	2026-10-30 11:55:02+03	2026-10-30 11:56:00+03	2026-10-30 08:59:00+03
ATUid_7e162098bc97098a1a0852d2bd0c6f91	+255616675940	user	24	{"data": {}, "scene": "user.send.phone", "stack": ["user.main"]}	1*0*2	2026-10-30 12:04:22+03	2026-10-30 12:05:20+03	2026-10-30 09:08:20+03
ATUid_a010a361850c82bd51d2c63746f16c5e	+255616675940	\N	\N	{"data": {"card": "4532786543267865", "name": "FRANK GODWIN", "email": "godwinfranklin411@gmail.com"}, "scene": "guest.reg.pin", "stack": ["guest.main", "guest.reg.name", "guest.reg.email", "guest.reg.card"]}	1*FRANK GODWIN*godwinfranklin411@gmail.com*4532786543267865	2026-10-30 11:57:51+03	2026-10-30 11:58:25+03	2026-10-30 09:01:25+03
ATUid_d0866a8b8766a1513976103b4d994824	+255616675940	\N	\N	{"data": {"card": "3245673897654327", "name": "FRANK GODWIN", "pinh": "$2b$10$w9WNWq5xvN0nu5EtkEelF.F0uIsLKLaXFeTU8LT4TloKvqBQWhCui", "email": "godwinfranklin411@gmail.com"}, "scene": "guest.reg.review", "stack": ["guest.main", "guest.reg.name", "guest.reg.email", "guest.reg.card", "guest.reg.pin", "guest.reg.pinConfirm"]}	1*FRANK GODWIN*godwinfranklin411@gmail.com*3245673897654327*6549*6549	2026-10-30 11:56:26+03	2026-10-30 11:57:24+03	2026-10-30 09:00:24+03
live-unknown-1	+255799999999	\N	\N	{"data": {}, "scene": "guest.main", "stack": []}		2026-10-30 10:06:32+03	2026-10-30 10:06:32+03	2026-10-30 07:09:32+03
live-user-1	+255769010940	user	5	{"data": {}, "scene": "user.balance", "stack": ["user.main"]}	5	2026-10-30 10:06:33+03	2026-10-30 10:06:33+03	2026-10-30 07:09:33+03
pub-bal-1793348504	+255700000001	user	11	{"data": {}, "scene": "user.balance", "stack": ["user.main"]}	5	2026-10-30 11:21:46+03	2026-10-30 11:21:48+03	2026-10-30 08:24:48+03
pub-verify-1	+255700000001	user	11	{"data": {}, "scene": "user.main", "stack": []}		2026-10-30 11:21:23+03	2026-10-30 11:21:23+03	2026-10-30 08:24:23+03
pub-verify-1793348491	+255700000001	user	11	{"data": {}, "scene": "user.account", "stack": ["user.main"]}	1	2026-10-30 11:21:33+03	2026-10-30 11:21:34+03	2026-10-30 08:24:34+03
smoke-1793350528	+255700000001	user	11	{"data": {}, "scene": "user.main", "stack": []}		2026-10-30 11:55:29+03	2026-10-30 11:55:29+03	2026-10-30 08:58:29+03
tok-check	+255700000001	user	11	{"data": {}, "scene": "user.main", "stack": []}		2026-10-30 11:29:52+03	2026-10-30 11:29:52+03	2026-10-30 08:32:52+03
verify-1	+255700000001	user	11	{"data": {}, "scene": "user.main", "stack": []}		2026-10-30 10:56:06+03	2026-10-30 10:56:06+03	2026-10-30 07:59:06+03
verify-2	+255700000001	user	11	{"data": {}, "scene": "user.main", "stack": []}		2026-10-30 11:03:09+03	2026-10-30 11:03:09+03	2026-10-30 08:06:09+03
verify-3	+255700000001	user	11	{"data": {}, "scene": "user.main", "stack": []}		2026-10-30 11:08:11+03	2026-10-30 11:08:11+03	2026-10-30 08:11:11+03
verify-1793354546	+255700000001	user	11	{"data": {}, "scene": "user.main", "stack": []}		2026-10-30 13:02:28.469+03	2026-10-30 13:02:28.469+03	2026-10-30 13:05:28.469+03
verifyb-1793354549	+255700000019	user	19	{"data": {}, "scene": "user.main", "stack": []}	5	2026-10-30 13:02:30.509+03	2026-10-30 13:02:30.509+03	2026-10-30 13:05:30.509+03
flow-1793354573	+255700000019	user	19	{"data": {}, "scene": "user.main", "stack": []}	5*0	2026-10-30 13:02:55.05+03	2026-10-30 13:02:58.6+03	2026-10-30 13:05:58.6+03
final-1793354878	+255700000019	user	19	{"data": {}, "scene": "user.main", "stack": []}	5	2026-10-30 13:08:00.192+03	2026-10-30 13:08:00.192+03	2026-10-30 13:11:00.192+03
sms-1793355657	+255700000019	user	19	{"data": {}, "scene": "user.main", "stack": []}		2026-10-30 13:20:58.991+03	2026-10-30 13:20:58.991+03	2026-10-30 13:23:58.991+03
v-1793357480	+255700000019	user	19	{"data": {}, "scene": "user.main", "stack": []}		2026-10-30 13:51:22.204+03	2026-10-30 13:51:22.204+03	2026-10-30 13:54:22.204+03
ATUid_3a604ce961ce03921f3ce5653a7e6bd7	+255616675940	\N	\N	{"data": {}, "scene": "guest.main", "stack": []}		2026-10-30 14:00:26.029+03	2026-10-30 14:00:26.029+03	2026-10-30 14:03:26.029+03
ATUid_014e8a928f23a1a8ec4ddac74b475e52	+255616675940	user	25	{"data": {}, "scene": "user.main", "stack": []}		2026-10-30 14:02:39.762+03	2026-10-30 14:02:39.762+03	2026-10-30 14:05:39.762+03
\.


--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE SET; Schema: drizzle; Owner: -
--

SELECT pg_catalog.setval('drizzle.__drizzle_migrations_id_seq', 4, true);


--
-- Name: admin_actions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.admin_actions_id_seq', 10, true);


--
-- Name: admins_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.admins_id_seq', 4, false);


--
-- Name: failed_login_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.failed_login_log_id_seq', 129, true);


--
-- Name: login_attempts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.login_attempts_id_seq', 9, true);


--
-- Name: security_questions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.security_questions_id_seq', 12, false);


--
-- Name: transactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.transactions_id_seq', 197, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 25, true);


--
-- Name: ussd_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.ussd_requests_id_seq', 74, true);


--
-- Name: ussd_security_events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.ussd_security_events_id_seq', 2, false);


--
-- Name: __drizzle_migrations __drizzle_migrations_pkey; Type: CONSTRAINT; Schema: drizzle; Owner: -
--

ALTER TABLE ONLY drizzle.__drizzle_migrations
    ADD CONSTRAINT __drizzle_migrations_pkey PRIMARY KEY (id);


--
-- Name: admin_actions admin_actions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_actions
    ADD CONSTRAINT admin_actions_pkey PRIMARY KEY (id);


--
-- Name: admins admins_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_email_unique UNIQUE (email);


--
-- Name: admins admins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_pkey PRIMARY KEY (id);


--
-- Name: admins admins_username_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_username_unique UNIQUE (username);


--
-- Name: failed_login_log failed_login_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.failed_login_log
    ADD CONSTRAINT failed_login_log_pkey PRIMARY KEY (id);


--
-- Name: failed_withdrawal_attempts failed_withdrawal_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.failed_withdrawal_attempts
    ADD CONSTRAINT failed_withdrawal_attempts_pkey PRIMARY KEY (user_id);


--
-- Name: login_attempts login_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.login_attempts
    ADD CONSTRAINT login_attempts_pkey PRIMARY KEY (id);


--
-- Name: security_questions security_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_questions
    ADD CONSTRAINT security_questions_pkey PRIMARY KEY (id);


--
-- Name: security_questions security_questions_question_key_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_questions
    ADD CONSTRAINT security_questions_question_key_unique UNIQUE (question_key);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (sid);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_transaction_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_transaction_id_unique UNIQUE (transaction_id);


--
-- Name: users users_card_number_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_card_number_unique UNIQUE (card_number);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_phone_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_unique UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: ussd_requests ussd_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ussd_requests
    ADD CONSTRAINT ussd_requests_pkey PRIMARY KEY (id);


--
-- Name: ussd_security_events ussd_security_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ussd_security_events
    ADD CONSTRAINT ussd_security_events_pkey PRIMARY KEY (id);


--
-- Name: ussd_sessions ussd_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ussd_sessions
    ADD CONSTRAINT ussd_sessions_pkey PRIMARY KEY (id);


--
-- Name: failed_login_log_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX failed_login_log_email_idx ON public.failed_login_log USING btree (email);


--
-- Name: login_attempts_email_ip_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX login_attempts_email_ip_idx ON public.login_attempts USING btree (email, ip_address);


--
-- Name: login_attempts_lockout_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX login_attempts_lockout_idx ON public.login_attempts USING btree (lockout_until);


--
-- Name: sessions_expire_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sessions_expire_idx ON public.sessions USING btree (expire);


--
-- Name: transactions_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX transactions_created_idx ON public.transactions USING btree (created_at);


--
-- Name: transactions_fraud_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX transactions_fraud_idx ON public.transactions USING btree (fraud_prediction, fraud_score);


--
-- Name: transactions_receiver_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX transactions_receiver_created_idx ON public.transactions USING btree (receiver_id, created_at);


--
-- Name: transactions_risk_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX transactions_risk_idx ON public.transactions USING btree (risk_level);


--
-- Name: transactions_sender_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX transactions_sender_created_idx ON public.transactions USING btree (sender_id, created_at);


--
-- Name: transactions_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX transactions_status_idx ON public.transactions USING btree (status);


--
-- Name: transactions_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX transactions_type_idx ON public.transactions USING btree (transaction_type);


--
-- Name: users_reset_token_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_reset_token_idx ON public.users USING btree (reset_token);


--
-- Name: ussd_requests_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ussd_requests_created_idx ON public.ussd_requests USING btree (created_at);


--
-- Name: ussd_requests_phone_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ussd_requests_phone_idx ON public.ussd_requests USING btree (phone, created_at);


--
-- Name: ussd_requests_session_text_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ussd_requests_session_text_uq ON public.ussd_requests USING btree (session_id, text_hash);


--
-- Name: ussd_security_events_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ussd_security_events_type_idx ON public.ussd_security_events USING btree (event_type, created_at);


--
-- Name: ussd_sessions_expires_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ussd_sessions_expires_idx ON public.ussd_sessions USING btree (expires_at);


--
-- Name: ussd_sessions_phone_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ussd_sessions_phone_idx ON public.ussd_sessions USING btree (phone);


--
-- Name: admin_actions admin_actions_admin_id_admins_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_actions
    ADD CONSTRAINT admin_actions_admin_id_admins_id_fk FOREIGN KEY (admin_id) REFERENCES public.admins(id) ON DELETE CASCADE;


--
-- Name: failed_withdrawal_attempts failed_withdrawal_attempts_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.failed_withdrawal_attempts
    ADD CONSTRAINT failed_withdrawal_attempts_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: transactions transactions_admin_id_admins_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_admin_id_admins_id_fk FOREIGN KEY (admin_id) REFERENCES public.admins(id) ON DELETE SET NULL;


--
-- Name: transactions transactions_receiver_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_receiver_id_users_id_fk FOREIGN KEY (receiver_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: transactions transactions_reviewed_by_admins_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_reviewed_by_admins_id_fk FOREIGN KEY (reviewed_by) REFERENCES public.admins(id) ON DELETE SET NULL;


--
-- Name: transactions transactions_sender_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_sender_id_users_id_fk FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict 1caAt4nGHVrugVaOJ230LaQeQhnQqF1RfmnAjU4tTvKOKY6mzP5swIrehtJxftU
