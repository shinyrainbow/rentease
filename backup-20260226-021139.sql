--
-- PostgreSQL database dump
--

\restrict AQaXGdZJDgriBjyIWoqLivQK5Axki0d8EXH0L1GYCVMUEFMW6ghiPIwNejQJOC2

-- Dumped from database version 17.8 (6108b59)
-- Dumped by pg_dump version 18.0

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

--
-- Name: ContractStatus; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."ContractStatus" AS ENUM (
    'DRAFT',
    'PENDING_TENANT',
    'SIGNED',
    'CANCELLED'
);


ALTER TYPE public."ContractStatus" OWNER TO neondb_owner;

--
-- Name: InvoiceStatus; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."InvoiceStatus" AS ENUM (
    'PENDING',
    'PARTIAL',
    'PAID',
    'OVERDUE',
    'CANCELLED'
);


ALTER TYPE public."InvoiceStatus" OWNER TO neondb_owner;

--
-- Name: InvoiceType; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."InvoiceType" AS ENUM (
    'RENT',
    'UTILITY',
    'COMBINED'
);


ALTER TYPE public."InvoiceType" OWNER TO neondb_owner;

--
-- Name: LineContactType; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."LineContactType" AS ENUM (
    'USER',
    'GROUP'
);


ALTER TYPE public."LineContactType" OWNER TO neondb_owner;

--
-- Name: MaintenanceCategory; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."MaintenanceCategory" AS ENUM (
    'ELECTRICAL',
    'PLUMBING',
    'STRUCTURAL',
    'HVAC',
    'GENERAL',
    'OTHER'
);


ALTER TYPE public."MaintenanceCategory" OWNER TO neondb_owner;

--
-- Name: MaintenancePriority; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."MaintenancePriority" AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH',
    'URGENT'
);


ALTER TYPE public."MaintenancePriority" OWNER TO neondb_owner;

--
-- Name: MaintenanceStatus; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."MaintenanceStatus" AS ENUM (
    'PENDING',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED'
);


ALTER TYPE public."MaintenanceStatus" OWNER TO neondb_owner;

--
-- Name: MessageDirection; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."MessageDirection" AS ENUM (
    'INCOMING',
    'OUTGOING'
);


ALTER TYPE public."MessageDirection" OWNER TO neondb_owner;

--
-- Name: MeterType; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."MeterType" AS ENUM (
    'ELECTRICITY',
    'WATER'
);


ALTER TYPE public."MeterType" OWNER TO neondb_owner;

--
-- Name: PaymentMethod; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."PaymentMethod" AS ENUM (
    'TRANSFER',
    'CHECK',
    'CASH'
);


ALTER TYPE public."PaymentMethod" OWNER TO neondb_owner;

--
-- Name: PaymentStatus; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."PaymentStatus" AS ENUM (
    'PENDING',
    'VERIFIED',
    'REJECTED'
);


ALTER TYPE public."PaymentStatus" OWNER TO neondb_owner;

--
-- Name: ProjectType; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."ProjectType" AS ENUM (
    'WAREHOUSE',
    'SHOP',
    'OFFICE',
    'MIXED'
);


ALTER TYPE public."ProjectType" OWNER TO neondb_owner;

--
-- Name: SlipSource; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."SlipSource" AS ENUM (
    'MANUAL',
    'LINE_CHAT',
    'LIFF'
);


ALTER TYPE public."SlipSource" OWNER TO neondb_owner;

--
-- Name: TenantType; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."TenantType" AS ENUM (
    'INDIVIDUAL',
    'COMPANY'
);


ALTER TYPE public."TenantType" OWNER TO neondb_owner;

--
-- Name: UnitStatus; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."UnitStatus" AS ENUM (
    'VACANT',
    'OCCUPIED',
    'RESERVED',
    'MAINTENANCE'
);


ALTER TYPE public."UnitStatus" OWNER TO neondb_owner;

--
-- Name: UnitType; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."UnitType" AS ENUM (
    'WAREHOUSE',
    'SHOP',
    'OFFICE',
    'STORAGE'
);


ALTER TYPE public."UnitType" OWNER TO neondb_owner;

--
-- Name: UserRole; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."UserRole" AS ENUM (
    'OWNER',
    'ADMIN',
    'STAFF'
);


ALTER TYPE public."UserRole" OWNER TO neondb_owner;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Account; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."Account" (
    id text NOT NULL,
    "userId" text NOT NULL,
    type text NOT NULL,
    provider text NOT NULL,
    "providerAccountId" text NOT NULL,
    refresh_token text,
    access_token text,
    expires_at integer,
    token_type text,
    scope text,
    id_token text,
    session_state text
);


ALTER TABLE public."Account" OWNER TO neondb_owner;

--
-- Name: FloorPlan; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."FloorPlan" (
    id text NOT NULL,
    "projectId" text NOT NULL,
    name text NOT NULL,
    floor integer NOT NULL,
    width double precision DEFAULT 800 NOT NULL,
    height double precision DEFAULT 600 NOT NULL,
    "imageUrl" text,
    "layoutData" jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."FloorPlan" OWNER TO neondb_owner;

--
-- Name: Invoice; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."Invoice" (
    id text NOT NULL,
    "invoiceNo" text NOT NULL,
    "projectId" text NOT NULL,
    "unitId" text NOT NULL,
    "tenantId" text NOT NULL,
    type public."InvoiceType" NOT NULL,
    status public."InvoiceStatus" DEFAULT 'PENDING'::public."InvoiceStatus" NOT NULL,
    "dueDate" timestamp(3) without time zone NOT NULL,
    subtotal double precision NOT NULL,
    "discountAmount" double precision DEFAULT 0 NOT NULL,
    "withholdingTax" double precision DEFAULT 0 NOT NULL,
    "totalAmount" double precision NOT NULL,
    "paidAmount" double precision DEFAULT 0 NOT NULL,
    "lineItems" jsonb,
    notes text,
    "sentViaLine" boolean DEFAULT false NOT NULL,
    "sentAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "tenantEmail" text,
    "tenantIdCard" text,
    "tenantName" text,
    "tenantNameTh" text,
    "tenantPhone" text,
    "tenantTaxId" text,
    "tenantType" public."TenantType",
    "invoiceDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Invoice" OWNER TO neondb_owner;

--
-- Name: LeaseContract; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."LeaseContract" (
    id text NOT NULL,
    "contractNo" text NOT NULL,
    "projectId" text NOT NULL,
    "unitId" text NOT NULL,
    "tenantId" text NOT NULL,
    title text,
    "titleTh" text,
    "baseRent" double precision NOT NULL,
    "commonFee" double precision,
    deposit double precision,
    "contractStart" timestamp(3) without time zone NOT NULL,
    "contractEnd" timestamp(3) without time zone NOT NULL,
    clauses jsonb,
    status public."ContractStatus" DEFAULT 'DRAFT'::public."ContractStatus" NOT NULL,
    "landlordSignature" text,
    "landlordSignedAt" timestamp(3) without time zone,
    "tenantSignature" text,
    "tenantSignedAt" timestamp(3) without time zone,
    "signingToken" text NOT NULL,
    "tokenExpiresAt" timestamp(3) without time zone,
    "pdfS3Key" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."LeaseContract" OWNER TO neondb_owner;

--
-- Name: LineContact; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."LineContact" (
    id text NOT NULL,
    "projectId" text NOT NULL,
    "tenantId" text,
    "lineUserId" text NOT NULL,
    "displayName" text,
    "pictureUrl" text,
    "statusMessage" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "contactType" public."LineContactType" DEFAULT 'USER'::public."LineContactType" NOT NULL,
    "lineOaId" text
);


ALTER TABLE public."LineContact" OWNER TO neondb_owner;

--
-- Name: LineMessage; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."LineMessage" (
    id text NOT NULL,
    "lineContactId" text NOT NULL,
    direction public."MessageDirection" NOT NULL,
    "messageType" text NOT NULL,
    content text,
    "mediaUrl" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."LineMessage" OWNER TO neondb_owner;

--
-- Name: LineOA; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."LineOA" (
    id text NOT NULL,
    name text NOT NULL,
    "lineChannelId" text,
    "lineChannelSecret" text,
    "lineAccessToken" text,
    "liffId" text,
    "ownerId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."LineOA" OWNER TO neondb_owner;

--
-- Name: MaintenanceRequest; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."MaintenanceRequest" (
    id text NOT NULL,
    "projectId" text NOT NULL,
    "unitId" text NOT NULL,
    title text NOT NULL,
    description text,
    category public."MaintenanceCategory" NOT NULL,
    priority public."MaintenancePriority" DEFAULT 'MEDIUM'::public."MaintenancePriority" NOT NULL,
    status public."MaintenanceStatus" DEFAULT 'PENDING'::public."MaintenanceStatus" NOT NULL,
    "imageUrls" text[],
    "resolvedAt" timestamp(3) without time zone,
    resolution text,
    "lineMessageId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."MaintenanceRequest" OWNER TO neondb_owner;

--
-- Name: MeterReading; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."MeterReading" (
    id text NOT NULL,
    "projectId" text NOT NULL,
    "unitId" text NOT NULL,
    type public."MeterType" NOT NULL,
    "previousReading" double precision NOT NULL,
    "currentReading" double precision NOT NULL,
    usage double precision NOT NULL,
    rate double precision NOT NULL,
    amount double precision NOT NULL,
    "readingDate" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "invoiceId" text
);


ALTER TABLE public."MeterReading" OWNER TO neondb_owner;

--
-- Name: Payment; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."Payment" (
    id text NOT NULL,
    "invoiceId" text NOT NULL,
    "tenantId" text NOT NULL,
    amount double precision NOT NULL,
    method public."PaymentMethod" NOT NULL,
    status public."PaymentStatus" DEFAULT 'PENDING'::public."PaymentStatus" NOT NULL,
    "slipUrl" text,
    "slipVerified" boolean DEFAULT false NOT NULL,
    "verifiedAt" timestamp(3) without time zone,
    "verifiedBy" text,
    "checkNo" text,
    "checkBank" text,
    "checkDate" timestamp(3) without time zone,
    "transferRef" text,
    "transferBank" text,
    notes text,
    "paidAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "invoiceDate" timestamp(3) without time zone,
    "invoiceNo" text,
    "invoiceTotalAmount" double precision,
    "tenantName" text,
    "tenantNameTh" text,
    "tenantType" public."TenantType"
);


ALTER TABLE public."Payment" OWNER TO neondb_owner;

--
-- Name: PaymentSlip; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."PaymentSlip" (
    id text NOT NULL,
    "paymentId" text NOT NULL,
    "s3Key" text NOT NULL,
    "fileName" text,
    "contentType" text,
    "uploadedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "uploadedBy" text,
    source public."SlipSource" DEFAULT 'MANUAL'::public."SlipSource" NOT NULL
);


ALTER TABLE public."PaymentSlip" OWNER TO neondb_owner;

--
-- Name: Project; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."Project" (
    id text NOT NULL,
    name text NOT NULL,
    "nameTh" text,
    description text,
    address text,
    type public."ProjectType" NOT NULL,
    "ownerId" text NOT NULL,
    "billingDay" integer DEFAULT 1 NOT NULL,
    "electricityRate" double precision DEFAULT 7.0 NOT NULL,
    "waterRate" double precision DEFAULT 18.0 NOT NULL,
    "taxId" text,
    "companyName" text,
    "companyNameTh" text,
    "companyAddress" text,
    "lineChannelId" text,
    "lineChannelSecret" text,
    "lineAccessToken" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "liffId" text,
    "bankAccountName" text,
    "bankAccountNumber" text,
    "bankName" text,
    "logoUrl" text,
    "lineOaId" text
);


ALTER TABLE public."Project" OWNER TO neondb_owner;

--
-- Name: Receipt; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."Receipt" (
    id text NOT NULL,
    "receiptNo" text NOT NULL,
    "invoiceId" text NOT NULL,
    amount double precision NOT NULL,
    "issuedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "sentViaLine" boolean DEFAULT false NOT NULL,
    "sentAt" timestamp(3) without time zone,
    "pdfUrl" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "invoiceDate" timestamp(3) without time zone,
    "invoiceNo" text,
    "invoiceTotalAmount" double precision,
    "tenantName" text,
    "tenantNameTh" text,
    "tenantTaxId" text,
    "tenantType" public."TenantType"
);


ALTER TABLE public."Receipt" OWNER TO neondb_owner;

--
-- Name: Session; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."Session" (
    id text NOT NULL,
    "sessionToken" text NOT NULL,
    "userId" text NOT NULL,
    expires timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Session" OWNER TO neondb_owner;

--
-- Name: Tenant; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."Tenant" (
    id text NOT NULL,
    "unitId" text NOT NULL,
    name text NOT NULL,
    "nameTh" text,
    email text,
    phone text,
    "idCard" text,
    "taxId" text,
    "tenantType" public."TenantType" DEFAULT 'INDIVIDUAL'::public."TenantType" NOT NULL,
    "withholdingTax" double precision DEFAULT 0 NOT NULL,
    "lineUserId" text,
    "contractStart" timestamp(3) without time zone,
    "contractEnd" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "baseRent" double precision DEFAULT 0 NOT NULL,
    "commonFee" double precision DEFAULT 0,
    deposit double precision,
    "discountAmount" double precision DEFAULT 0,
    "discountPercent" double precision DEFAULT 0,
    "electricMeterNo" text,
    "waterMeterNo" text,
    address text,
    "imageUrl" text
);


ALTER TABLE public."Tenant" OWNER TO neondb_owner;

--
-- Name: Unit; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."Unit" (
    id text NOT NULL,
    "projectId" text NOT NULL,
    "unitNumber" text NOT NULL,
    floor integer DEFAULT 1 NOT NULL,
    size double precision,
    type public."UnitType" NOT NULL,
    status public."UnitStatus" DEFAULT 'VACANT'::public."UnitStatus" NOT NULL,
    "positionX" double precision,
    "positionY" double precision,
    width double precision,
    height double precision,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Unit" OWNER TO neondb_owner;

--
-- Name: User; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."User" (
    id text NOT NULL,
    name text,
    email text NOT NULL,
    "emailVerified" timestamp(3) without time zone,
    password text,
    image text,
    role public."UserRole" DEFAULT 'OWNER'::public."UserRole" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."User" OWNER TO neondb_owner;

--
-- Name: VerificationToken; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."VerificationToken" (
    identifier text NOT NULL,
    token text NOT NULL,
    expires timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."VerificationToken" OWNER TO neondb_owner;

--
-- Data for Name: Account; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."Account" (id, "userId", type, provider, "providerAccountId", refresh_token, access_token, expires_at, token_type, scope, id_token, session_state) FROM stdin;
\.


--
-- Data for Name: FloorPlan; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."FloorPlan" (id, "projectId", name, floor, width, height, "imageUrl", "layoutData", "createdAt", "updatedAt") FROM stdin;
cmlxy5anl000004l8q4sz4td8	cmlenip02000004ju1lapov3k	Floor 1	1	800	600	\N	{"decorations": []}	2026-02-22 16:12:57.009	2026-02-22 16:12:57.009
cmlxy5aoc000004jlj4szrq89	cmlen9ti6000004kyd1n0kqrq	Floor 1	1	800	600	\N	{"decorations": [{"id": "dec-1771776795619", "color": "#1a1a1a", "label": "empty", "width": 120, "height": 80, "positionX": 300, "positionY": 130}]}	2026-02-22 16:12:57.036	2026-02-22 16:13:22.846
\.


--
-- Data for Name: Invoice; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."Invoice" (id, "invoiceNo", "projectId", "unitId", "tenantId", type, status, "dueDate", subtotal, "discountAmount", "withholdingTax", "totalAmount", "paidAmount", "lineItems", notes, "sentViaLine", "sentAt", "createdAt", "updatedAt", "tenantEmail", "tenantIdCard", "tenantName", "tenantNameTh", "tenantPhone", "tenantTaxId", "tenantType", "invoiceDate") FROM stdin;
cmlg1iere000004juwirvgi78	INV-BIZ-202602-2265	cmlen9ti6000004kyd1n0kqrq	cmleqiwez000004jyut9udiq8	cmler8qo8000104lcaoio6xfw	RENT	PENDING	2026-03-15 00:00:00	29473.68	0	1473.684	27999.996	0	[{"amount": 29473.68, "description": "ค่าเช่า / Rent"}]	\N	f	\N	2026-02-10 03:27:16.534	2026-02-10 03:27:16.534	\N	\N	CAM TECH SOUTHEAST ASIA CO.,LTD	\N	\N	0105567017897	COMPANY	2026-02-10 03:27:16.52
cmm2bpvve000004l1p3hcrl6f	INV-BIZ-202602-0229	cmlen9ti6000004kyd1n0kqrq	cmleqiwez000004jyut9udiq8	cmler8qo8000104lcaoio6xfw	RENT	PENDING	2026-03-14 00:00:00	29473.68	0	1473.684	27999.996	0	[{"amount": 29473.68, "description": "ค่าเช่า / Rent"}]	\N	f	\N	2026-02-25 17:43:57.327	2026-02-25 17:43:57.327	\N	\N	CAM TECH SOUTHEAST ASIA CO.,LTD	\N	\N	0105567017897	COMPANY	2026-02-25 17:43:57.307
cmly392ph000004ifpcycqi00	INV-BIZ-202602-6580	cmlen9ti6000004kyd1n0kqrq	cmleqiwez000004jyut9udiq8	cmler8qo8000104lcaoio6xfw	UTILITY	PENDING	2026-03-14 00:00:00	0	0	0	0	0	[]	\N	t	2026-02-25 17:44:52.41	2026-02-22 18:35:51.405	2026-02-25 17:44:52.416	\N	\N	CAM TECH SOUTHEAST ASIA CO.,LTD	\N	\N	0105567017897	COMPANY	2026-02-22 18:35:51.392
cmm2c1vj0000004jxlw14qzhm	INV-BIZ-202602-5355	cmlen9ti6000004kyd1n0kqrq	cmleqiwez000004jyut9udiq8	cmler8qo8000104lcaoio6xfw	UTILITY	PENDING	2026-03-14 00:00:00	7150	0	357.5	6792.5	0	[{"amount": 7150, "description": "ค่าไฟฟ้า / Electricity (1100 units x ฿6.5)"}]	\N	f	\N	2026-02-25 17:53:16.752	2026-02-25 17:53:16.752	\N	\N	CAM TECH SOUTHEAST ASIA CO.,LTD	\N	\N	0105567017897	COMPANY	2026-02-25 17:53:16.69
\.


--
-- Data for Name: LeaseContract; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."LeaseContract" (id, "contractNo", "projectId", "unitId", "tenantId", title, "titleTh", "baseRent", "commonFee", deposit, "contractStart", "contractEnd", clauses, status, "landlordSignature", "landlordSignedAt", "tenantSignature", "tenantSignedAt", "signingToken", "tokenExpiresAt", "pdfS3Key", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: LineContact; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."LineContact" (id, "projectId", "tenantId", "lineUserId", "displayName", "pictureUrl", "statusMessage", "createdAt", "updatedAt", "contactType", "lineOaId") FROM stdin;
cmlenl7x9000004jotdvx0v96	cmlen9ti6000004kyd1n0kqrq	\N	Uc921b0487e0279bb9743088c673a64f9	APIRAT89	https://sprofile.line-scdn.net/0hSdDtdvuqDEtpDScyZANyNBldDyFKfFVZRWkWLwsLAikHak8dQjsRfVoLBX8Hah8bRG1ALF5ZAillHnstd1vwf249UXpVNUoURW9Aqg	TYPE1GROUP.Co.Ltd.	2026-02-09 04:09:46.842	2026-02-09 04:09:46.842	USER	\N
cmletgwiu000004jog9ukt795	cmlen9ti6000004kyd1n0kqrq	\N	U0c2a6fe1b90373d444fafb569949b039	:M	https://sprofile.line-scdn.net/0hMbVnpAb1Ek17FwEXWAdsMgtHESdYZktfUXZZLU4SH3RCc1wdUHNcLkofSntALl0bU3ZbKh4fRS53BGUrZUHueXwnT3xHL1QSV3VerA	triplem	2026-02-09 06:54:23.127	2026-02-09 06:54:23.127	USER	\N
cmlenfb6i000004l724chbksu	cmlen9ti6000004kyd1n0kqrq	\N	U6abd14d2aea5356fd360f44c0b5710d6	Winnie	https://sprofile.line-scdn.net/0hIzOMIuZEFlViNAlZNphoaxJkFT9BRU9HTVQOOlU3Tm1bBwEAHVMLNgA1G20KV1JXHVdfY1BmQDBAZQJbMxo-NiU3EwA-ZSgHOCI4MBFrAyAsei4LLRAPY1RtTjgfQRVVODoeUyU1LRcLGFNQJiJbbBcwEj44YVlWTmN6A2cGeNYNNmEAT1NRMl40TGbY	💭	2026-02-09 04:05:11.125	2026-02-09 10:25:47.569	USER	\N
cmliof9wt000004k1k3lyq9e5	cmlen9ti6000004kyd1n0kqrq	\N	Ub74fcd781d2c3827ea357cbdd1ab7487	Unknown User	\N	\N	2026-02-11 23:44:13.802	2026-02-11 23:44:13.802	USER	\N
cmlj0ved5000004l5t8dh3lgo	cmlen9ti6000004kyd1n0kqrq	\N	Ua27c3c21f65907caa5b00b0b71577878	Natkhanate	https://profile.line-scdn.net/0m0e5c6c967251306be41c80f466d63bdd9dc2d3814ceb	😙	2026-02-12 05:32:41.46	2026-02-12 05:32:41.46	USER	\N
cmlkko68f000004jsubz79a4z	cmlen9ti6000004kyd1n0kqrq	\N	U882960ea1665fbcdc2d58a1d5ee2371b	Thunyarat 245	https://sprofile.line-scdn.net/0hDwz1YjFEG1hXSDAhiEdlJycYGDJ0OUJKL31RbmUbRzo9cAsPfyoGPDcYFmxvfF9bK3lWNzZNF21bW2w-SR7nbFB4RmlrcF0HeypXuQ	\N	2026-02-13 07:34:42.827	2026-02-13 07:34:42.827	USER	\N
cmlm4kis6000004jrt63w4ktg	cmlen9ti6000004kyd1n0kqrq	\N	Ub3e94f118102fc61a534921d59aa9bf2	Bluee	https://sprofile.line-scdn.net/0hc2CsB3T2PB1uCiyGRURCYh5aP3dNe2UPRjwmeloMMSVRb3IYR292fFICMH9Xb3tLED4mfFhday9iGUt7cFzAKWk6YSxSMnpCQmhw_A	\N	2026-02-14 09:39:30.961	2026-02-14 09:39:30.961	USER	\N
cmlqqgg42000004la6ganwygl	cmlen9ti6000004kyd1n0kqrq	\N	U6546ce5b167323cb830bae9c4e3b09fe	Faii🌷 ʕっ•ᴥ•ʔっ	https://sprofile.line-scdn.net/0hyY-WWmRyJnYALjgPWsVYSHB-JRwjX39kLRxsRzQnf0FoF2MmLxhqQGYrehQ4GjF1fEg7E2Upf0MiZ2Z-Kj00cVV8ejBHGD8lezcuY3cqDDx_WwZZcQwOVj1ZMFpZQyZQRS8vUk5FI0J0Wh5AX0kddk4yPjg6WDheeHlKIAUcSPVvLFEjLUlhETwufEW6	ไลน์โดนลบ กู้คืนมาได้ แต่หลุดจากกลุ่มเพียบ	2026-02-17 15:03:17.132	2026-02-17 15:03:17.132	USER	\N
cmlrrlib7000004l4sq3963o7	cmlen9ti6000004kyd1n0kqrq	\N	U3be3a4444a512a6172d3027bacd7904f	Unknown User	\N	\N	2026-02-18 08:22:59.046	2026-02-18 08:22:59.046	USER	\N
cmlrs0445000204l4w0h7j34l	cmlen9ti6000004kyd1n0kqrq	\N	U1219d8117245a4004c789aca9e8195e2	Unknown User	\N	\N	2026-02-18 08:34:20.499	2026-02-18 08:34:20.499	USER	\N
cmlrs41k3000404l4r2auyrsc	cmlen9ti6000004kyd1n0kqrq	\N	U665b2564de84ed383bd53ae14e61d79f	Unknown User	\N	\N	2026-02-18 08:37:23.809	2026-02-18 08:37:23.809	USER	\N
cmlrt6yoo000004kv49artgxu	cmlen9ti6000004kyd1n0kqrq	\N	Udd9ff3a755dcc3f9190f30c3e9a5f727	ⓅⒶⒺⓌ	https://sprofile.line-scdn.net/0hVabjdJlWCU5PExfVLZF3cD9DCiRsYlBcZ3EUe3lEVCxxdxsQNndDIXoTXnZ6dkcbZn1ELn5EUH5tei5FEA5Ccn96BwQbIwZaZxEYWwBsKTkme0lHOABFSwVjHClwIQhsNX0ndDx6ADkUViZ_Yi4ZcQMSKhUrYjlFK0RlGEohZ80gEX4bYnROKXMTU331	•ชีวิตมันสั้น ใช้แบบวันต่อวันพอ•	2026-02-18 09:07:39.668	2026-02-18 09:07:39.668	USER	\N
cmls1p40m000004l6fb5m9h80	cmlen9ti6000004kyd1n0kqrq	\N	U05d733a5025febbd1a3da2f022710555	Kridtika Meen	https://sprofile.line-scdn.net/0hTZqLzIu4C3VcNRWFTlp1SyxlCB9_RFJnIFBGFzozAhBiAkhzdgdHQWgwVRZoABtxcloXRjxnUUN-dg0gcxM3dxdvUQA5UB9Kd1sTRAphJQ0RAAU_B1I_Vy90ExYccEV-BAUhQyFDJQMSBD9UJFE2SjtDUg4lcRlRGWJnI1kHZfYzN3wgcVJMEmA1UUbm	(musical note)(musical note)(laugh Moon)(heart eyes Cony)(heart)(scream)(wow)(finger heart)	2026-02-18 13:05:43.306	2026-02-18 13:05:43.306	USER	\N
cmls31lfv000504l6tlhrqhkh	cmlen9ti6000004kyd1n0kqrq	\N	Ub792b110ad15df908d1ae64823da3454	ทราย	https://sprofile.line-scdn.net/0hDkrU56S4G0RfLAvwClBlOy98GC58XUJWcU4BI2slRyNmT1xAdEMDJ21-QCRmG1lFcB4AJm0rTHNTP2wiQXrncFgcRnVjFF0bc05XpQ	😍คุณ😍	2026-02-18 13:43:25.385	2026-02-18 13:43:25.385	USER	\N
cmlulaeqc000004l8rxjqtokv	cmlen9ti6000004kyd1n0kqrq	\N	U59ae270f852af01767aa4da050b0f617	FonPed ⑤ ϟ ④ ❃	https://sprofile.line-scdn.net/0hd709OYm1OxgdQBEKWeZFZ20QOHI-MWIKZnRyfiAXMnolJH1LMSdwKngVNn9zInROOCAkfiwUYygRU0x-AxbHLBpwZikheH1HMSJ3-Q	Settler4event(hacker girl)	2026-02-20 07:49:42.024	2026-02-20 07:49:42.024	USER	\N
cmm1t2h81000004jpd0klcue1	cmlen9ti6000004kyd1n0kqrq	\N	Ccca81897d6cab7f68f44c9c23d892e5c	โกดังนวลจันทร์56	https://sprofile.line-scdn.net/0hStDWMoYDDFtpLhIC2LtyJBl-DzFKSFVfF0lKblktUGkBHBgJTEgWOVx9BmxcS05eFk9FaQsnVmtlPXs9d3jwb24eUWpVFkoERUxAug	\N	2026-02-25 09:01:52.172	2026-02-25 09:01:52.172	GROUP	\N
cmm2bp6si000004laeko7yreg	cmlen9ti6000004kyd1n0kqrq	cmler8qo8000104lcaoio6xfw	C07a65d52dabc41703ef284091a00ae35	Test	https://sprofile.line-scdn.net/0htmAcCCkaK0JsGjS6RfZVPRxKKChPfHJGFHVlcQsTfCBTeWsXRHoxJVgadncEIzxBQSkxcF0ZISBgCVwkckzXdmsqdnNQIm0dQHhnow	\N	2026-02-25 17:43:24.822	2026-02-25 17:44:41.478	GROUP	\N
\.


--
-- Data for Name: LineMessage; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."LineMessage" (id, "lineContactId", direction, "messageType", content, "mediaUrl", "createdAt") FROM stdin;
cmlenfg61000104l7n1v9g9kh	cmlenfb6i000004l724chbksu	INCOMING	text	สวัสดีค่ะ	\N	2026-02-09 04:05:17.593
cmlenl7xj000104jolvxcif3d	cmlenl7x9000004jotdvx0v96	INCOMING	text	..	\N	2026-02-09 04:09:46.855
cmletgwjo000104jozbzrz01r	cmletgwiu000004jog9ukt795	INCOMING	text	สวัสดีค่ะไหมอยากจะขอติดต่อแจ้งเปลี่ยนผู้เช่าโกดัง C5 จากบริษัท ดอทแทมป์ เป็นบริษัท เอนี่ติง อ็อบเจ็คค่ะ เจ้าของบริษัททั้ง 2 เป็นเจ้าของเดียวกันค่ะ แต่เนื่องจากจดจัดตั้งบ.แล้วเลยอยากขอเปลี่ยนชื่อผู้เช่าค่ะ	\N	2026-02-09 06:54:23.172
cmletoouh000004i5v71hdfz1	cmletgwiu000004jog9ukt795	INCOMING	text	ขอบคุณมากนะคะ	\N	2026-02-09 07:00:26.441
cmletq0y7000104i5ngqfck7z	cmletgwiu000004jog9ukt795	INCOMING	text	สำหรับเอกสารสำเนาบัตรประชาชนเดิมของคุณอภิรัฐ ไหมขออนุญาตจัดส่งคืนให้พร้อมกับหนังสือรับรองการหัก ณ ที่จ่ายค่าเช่าของเดือนก.พ. ที่ชำระไปเมื่อวันที่ 5 นะคะ	\N	2026-02-09 07:01:28.783
cmletqayr000204jo0fof6p7g	cmletgwiu000004jog9ukt795	INCOMING	sticker	\N	\N	2026-02-09 07:01:41.763
cmleyjkcn000004ldeo4hi186	cmlenfb6i000004l724chbksu	INCOMING	image	\N	600284224977109165	2026-02-09 09:16:25.415
cmleyldu9000104ldclcchdm7	cmlenfb6i000004l724chbksu	OUTGOING	image	📄 ใบแจ้งหนี้\nเลขที่: INV-BIZ-202602-1842\nห้อง: C1\nรอบบิล: 2026-02\nยอดชำระ: ฿27,999.996\nกำหนดชำระ: 15 มีค 2026\n\nกรุณาชำระภายในกำหนด	https://rent-ease.s3.ap-southeast-1.amazonaws.com/line-images/invoice-cmleyl8iq000004l8svmxjzzb-th-1770628669833.png	2026-02-09 09:17:50.289
cmleymf43000204l8hg9xklbn	cmlenfb6i000004l724chbksu	OUTGOING	image	🧾 ใบเสร็จรับเงิน\nเลขที่: RCP-BIZ-202602-2885\nห้อง: C1\nจำนวนเงิน: ฿27,999.996\nวันที่: 9 กพ 2026\n\nขอบคุณที่ชำระเงิน	https://rent-ease.s3.ap-southeast-1.amazonaws.com/line-images/receipt-cmleym9o0000104l8mdwrqile-th-1770628718221.png	2026-02-09 09:18:38.595
cmlj0vee1000104l5vwn0mb45	cmlj0ved5000004l5t8dh3lgo	INCOMING	text	เดี๋ยวจัดการให้นะครับ	\N	2026-02-12 05:32:41.497
cmlm4kiso000104jrwgadf6nm	cmlm4kis6000004jrt63w4ktg	INCOMING	text	หักณที่จ่าย ปกติ ได้รับมั้ยคะ	\N	2026-02-14 09:39:30.984
cmlm4ntzz000204jrld42ka4y	cmlm4kis6000004jrt63w4ktg	INCOMING	text	รบกวนขอเบอร์โทรค่ะ	\N	2026-02-14 09:42:05.471
cmlm4ut9i000304jro2b124pc	cmlm4kis6000004jrt63w4ktg	INCOMING	text	ขอบคุณคะ	\N	2026-02-14 09:47:31.11
cmlrrliby000104l4wgen6ksp	cmlrrlib7000004l4sq3963o7	INCOMING	text	ตามไห้คับ	\N	2026-02-18 08:22:59.086
cmlrs044n000304l44d7m3m8x	cmlrs0445000204l4w0h7j34l	INCOMING	text	รับทราบค่ะ (^^) 	\N	2026-02-18 08:34:20.519
cmlrs41kb000504l4784210hc	cmlrs41k3000404l4r2auyrsc	INCOMING	text	ได้ค่ะ เดี่ยวส่งให้ทางเมลนี้ ให้ใหม่นะค่ะ	\N	2026-02-18 08:37:23.819
cmlrt6ypc000104kvjdg62g51	cmlrt6yoo000004kv49artgxu	INCOMING	text	เดือน 4 ไม่ได้หัก ณที่จ่ายนะคะ  ลงบัญชีเป็น -> เงินประกันความเสียหาย-เช่าโกดัง  	\N	2026-02-18 09:07:39.696
cmlrt7bgj000204kv6vu8pi14	cmlrt6yoo000004kv49artgxu	INCOMING	text	โอนยอดเต็ม รบกวนเช็คกับบัญชีอีกทีนะคะ	\N	2026-02-18 09:07:56.227
cmlrtvlne000304kvdi6tz4wb	cmlm4kis6000004jrt63w4ktg	INCOMING	text	ได้เลยคะ	\N	2026-02-18 09:26:49.177
cmlrtw5cr000404kvpf0ssjob	cmlrs41k3000404l4r2auyrsc	INCOMING	text	ส่งเมลให้แล้วนะค่ะ	\N	2026-02-18 09:27:14.714
cmlrub2nj000504kvzwncqfcq	cmlrs41k3000404l4r2auyrsc	INCOMING	text	ขอบคุณค่ะ	\N	2026-02-18 09:38:51.055
cmls1p41q000104l67h49i698	cmls1p40m000004l6fb5m9h80	INCOMING	text	ส่งไปรษณีย์ไปแล้วนะคะ	\N	2026-02-18 13:05:43.358
cmls2a92t000204l6bv2q5nzo	cmls1p40m000004l6fb5m9h80	INCOMING	text	ไม่เคยค้างสักเดือนเลยคะ	\N	2026-02-18 13:22:09.653
cmls2aj1q000304l6ttqfi3ql	cmls1p40m000004l6fb5m9h80	INCOMING	text	ที่ออฟฟิศยังมีสำเนาอยู่คะ	\N	2026-02-18 13:22:22.574
cmls2b0mv000404l6jrvcrncu	cmls1p40m000004l6fb5m9h80	INCOMING	text	เดียวพรุ่งนี้ให้น้องเขาสแกนให้ก็ได้คะ	\N	2026-02-18 13:22:45.367
cmlulaer0000104l8pyth3rst	cmlulaeqc000004l8rxjqtokv	INCOMING	text	ขอบคุณค่า	\N	2026-02-20 07:49:42.06
cmlulah15000204l8tkydszir	cmlulaeqc000004l8rxjqtokv	INCOMING	text	C8 นะคะ	\N	2026-02-20 07:49:45.017
cmlulavip000304l8g6cmldu3	cmlulaeqc000004l8rxjqtokv	INCOMING	text	โอเคค่ะ รีบแจ้งนะค่า	\N	2026-02-20 07:50:03.793
cmlumdvsr000404l8ceeqbw3h	cmlulaeqc000004l8rxjqtokv	INCOMING	text	สอบถามหน่อยค่า ถ้าเค้าย้ายออกแล้วขอเข้าดู พท หน่อยได้ไหมคะ และถ้า พท โอเคจะขอเซ็นสัญญาที่นี่ต่อเลยค่า	\N	2026-02-20 08:20:23.739
cmlumrwxo000504l8gdqk2hf1	cmlulaeqc000004l8rxjqtokv	INCOMING	text	ขอบคุณค่า พอแจ้งวันได้ไหมค่า ว่าประมาณวันไหนที่ไปดูได้ค่า	\N	2026-02-20 08:31:18.396
cmlumvtx9000604l8j337coeg	cmlulaeqc000004l8rxjqtokv	INCOMING	text	ได้เลยค่า ขอบคุณนะค่า	\N	2026-02-20 08:34:21.117
cmlumwal4000704l8b1ih4gx8	cmlulaeqc000004l8rxjqtokv	INCOMING	sticker	\N	\N	2026-02-20 08:34:42.712
cmlyon7zb000004jvez63zupe	cmletgwiu000004jog9ukt795	INCOMING	text	0624195250 ค่ะ	\N	2026-02-23 04:34:43.367
cmlyonpor000004l5vms58ezu	cmletgwiu000004jog9ukt795	INCOMING	text	สามารถติดต่อไหมได้เลยนะคะ	\N	2026-02-23 04:35:06.315
cmlyonrg7000104l51s55mnuh	cmletgwiu000004jog9ukt795	INCOMING	sticker	\N	\N	2026-02-23 04:35:08.599
cmlyoy8wf000204l51ng9shge	cmletgwiu000004jog9ukt795	INCOMING	file	\N	\N	2026-02-23 04:43:17.775
cmlyoyvgn000304l5kzby15h2	cmletgwiu000004jog9ukt795	INCOMING	text	อันนี้เป็นหนังสือรับรองบริษัทนะคะ	\N	2026-02-23 04:43:47.015
cmlypo06k000404l50wzdrnxz	cmletgwiu000004jog9ukt795	INCOMING	text	สวัสดีค่ะ ไหมปรึกษากับทางบัญชีแล้วคิดว่าเป็นการทำสัญญาใหม่กับทางเอนี่ติงเลยน่าจะสะดวกกว่านะคะ	\N	2026-02-23 05:03:19.532
cmlypoonl000504l54dt9tegm	cmletgwiu000004jog9ukt795	INCOMING	text	ส่วนเงินประกันไม่ทราบว่าทางบิซสเปซสะดวกเป็นแบบไหนดีคะ	\N	2026-02-23 05:03:51.249
cmlysj6n4000004l7z3gq526n	cmlm4kis6000004jrt63w4ktg	INCOMING	text	ขอยอดอีกทีค่า	\N	2026-02-23 06:23:33.472
cmlyuzj3x000004jxywcje4xh	cmlm4kis6000004jrt63w4ktg	INCOMING	image	\N	602303110543311411	2026-02-23 07:32:15.357
cmlyv13wc000104jx8mh95i4l	cmlm4kis6000004jrt63w4ktg	INCOMING	image	\N	602303236002808425	2026-02-23 07:33:28.956
cmlyv16le000204jxasbn34li	cmlm4kis6000004jrt63w4ktg	INCOMING	image	\N	602303241992798297	2026-02-23 07:33:32.45
cmlyv1i1l000304jxesybjp28	cmlm4kis6000004jrt63w4ktg	INCOMING	image	\N	602303266419900421	2026-02-23 07:33:47.289
cmlz9wlul000004i6dwmzlfnu	cmlj0ved5000004l5t8dh3lgo	INCOMING	image	\N	602345149481877966	2026-02-23 14:29:53.181
cmlz9x2p2000104i6eijvpi4i	cmlj0ved5000004l5t8dh3lgo	INCOMING	text	ดครไหมคนับ	\N	2026-02-23 14:30:15.014
cmlz9x8bo000204i6jk1iwbnx	cmlj0ved5000004l5t8dh3lgo	INCOMING	text	ครบ	\N	2026-02-23 14:30:22.308
cmlza0r2m000304i63dmjarp4	cmlj0ved5000004l5t8dh3lgo	INCOMING	image	\N	602345476972609605	2026-02-23 14:33:06.574
cmlza0rev000404i61gbpp3g2	cmlj0ved5000004l5t8dh3lgo	INCOMING	image	\N	602345477174460827	2026-02-23 14:33:07.015
cmlza19t6000504i626m701yr	cmlj0ved5000004l5t8dh3lgo	INCOMING	sticker	\N	\N	2026-02-23 14:33:30.858
cmm016y41000004l5wsswbeei	cmletgwiu000004jog9ukt795	INCOMING	text	ไม่มีส่วนลดใช่มั้ยคะ🥹	\N	2026-02-24 03:13:45.265
cmm01hmrm000104l5ubguh9yq	cmletgwiu000004jog9ukt795	INCOMING	text	รับทราบค่ะ	\N	2026-02-24 03:22:03.778
cmm01hnw1000204l5ifxnpjep	cmletgwiu000004jog9ukt795	INCOMING	sticker	\N	\N	2026-02-24 03:22:05.233
cmm0l867k000004jm8ac0gbrr	cmletgwiu000004jog9ukt795	INCOMING	text	สวัสดีค่ะ ไม่ทราบว่าการทำเซ็นสัญญาใหม่ ทางบิซสเปซสะดวกเป็นวันไหนดีคะ พอดีไหมจะได้เช็คกับคุณแต๊ป คุณเอกอีกครั้งนะคะ	\N	2026-02-24 12:34:34.736
cmm0lhg79000104jmwji8agel	cmletgwiu000004jog9ukt795	INCOMING	text	ต้องขออภัยด้วยนะคะ ไม่ทราบว่าถ้าไหมขออนุญาตเป็นการรับ-ส่งเอกสารมาเซ็นได้มั้ยคะ พอดีไหมเช็คกับทางคุณแต๊ปแล้วช่วงนี้คุณแต๊ปจะติดงานยาวเลยค่ะ	\N	2026-02-24 12:41:47.589
cmm1edsqt000004l2xcjseean	cmletgwiu000004jog9ukt795	INCOMING	text	ไม่ทราบว่าสำหรับสัญญาเก่าและสัญญาใหม่ไหมต้องเตรียมเอกสารอะไรเพิ่มเติมนอกจากหนังสือรับรองและสำเนาบัตรประชาชนมั้ยคะ	\N	2026-02-25 02:10:46.085
cmm1fwirk000104l2i4slqwtc	cmletgwiu000004jog9ukt795	INCOMING	text	รับทราบค่ะ เดี๋ยวทางไหมจัดเตรียมเอกสารเสร็จแล้ว ก่อนจัดส่งจะแจ้งอีกครั้งนะคะ	\N	2026-02-25 02:53:19.232
cmm1fx3r7000204l2s94hynev	cmletgwiu000004jog9ukt795	INCOMING	text	ไหมสามารถปักหมุดการรับส่งเอกสารได้ที่เดิมเลยใช่มั้ยคะ	\N	2026-02-25 02:53:46.435
cmm1m8ov9000004l4aynyuw7t	cmlm4kis6000004jrt63w4ktg	INCOMING	text	คุณพี่ จะรบกวนถ่ายสัญญาเช่ากับรูปโฉนดที่ดินหน้าหลังให้ได้มั้ยคะ🙏🏻	\N	2026-02-25 05:50:44.709
cmm1meuvp000104l4bykusid3	cmlm4kis6000004jrt63w4ktg	INCOMING	text	ใช้เอกสารบจก กู้คะ	\N	2026-02-25 05:55:32.437
cmm1qmtpc000004kycan2w6zw	cmletgwiu000004jog9ukt795	INCOMING	text	ไม่ทราบว่าสะดวกให้ไหมเข้ารับเอกสารวันพรุ่งนี้ช่วง 11.00 โมงมั้ยคะ	\N	2026-02-25 07:53:42.624
cmm1r4lou000004l4acq00agw	cmlm4kis6000004jrt63w4ktg	INCOMING	text	วันศุกร์ส่งไปรษณีย์ให้นะคะ	\N	2026-02-25 08:07:32.046
cmm1sxos2000104l4pi6kqb2u	cmletgwiu000004jog9ukt795	INCOMING	sticker	\N	\N	2026-02-25 08:58:08.69
cmm1szb27000204l4xfqqg3vs	cmletgwiu000004jog9ukt795	INCOMING	text	รับทราบค่ะ ขอบคุณมากนะคะ	\N	2026-02-25 08:59:24.223
cmm1t2h94000104jp384qg9k1	cmm1t2h81000004jpd0klcue1	INCOMING	text	ได้คับ	\N	2026-02-25 09:01:52.216
cmm1z3k6c000004l7e6pqsv9w	cmls31lfv000504l6tlhrqhkh	INCOMING	text	สอบถามราคาเช่าค่ะ	\N	2026-02-25 11:50:40.356
cmm2br2k4000104lacyihj5fe	cmm2bp6si000004laeko7yreg	OUTGOING	image	📄 ใบแจ้งหนี้\nเลขที่: INV-BIZ-202602-6580\nห้อง: C1\nยอดชำระ: ฿0\nกำหนดชำระ: 14 มีค 2026\n\nกรุณาชำระภายในกำหนด	https://rent-ease.s3.ap-southeast-1.amazonaws.com/line-images/invoice-cmly392ph000004ifpcycqi00-th-1772041492283.png	2026-02-25 17:44:52.66
\.


--
-- Data for Name: LineOA; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."LineOA" (id, name, "lineChannelId", "lineChannelSecret", "lineAccessToken", "liffId", "ownerId", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: MaintenanceRequest; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."MaintenanceRequest" (id, "projectId", "unitId", title, description, category, priority, status, "imageUrls", "resolvedAt", resolution, "lineMessageId", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: MeterReading; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."MeterReading" (id, "projectId", "unitId", type, "previousReading", "currentReading", usage, rate, amount, "readingDate", "createdAt", "updatedAt", "invoiceId") FROM stdin;
cmlg15v41000604k14ka1s6q3	cmlen9ti6000004kyd1n0kqrq	cmleqiwez000004jyut9udiq8	WATER	3	4	1	20	20	2026-01-25 00:00:00	2026-02-10 03:17:31.197	2026-02-10 03:17:31.197	\N
cmlg156r1000304kv2u2xggyb	cmlen9ti6000004kyd1n0kqrq	cmleqiwez000004jyut9udiq8	ELECTRICITY	4000	5000	1000	6.5	6500	2026-02-22 00:00:00	2026-02-10 03:16:59.625	2026-02-22 17:30:38.097	\N
cmly38o7n000004l4zirm1b5j	cmlen9ti6000004kyd1n0kqrq	cmleqiwez000004jyut9udiq8	ELECTRICITY	800	1900	1100	6.5	7150	2026-02-22 00:00:00	2026-02-22 18:35:32.622	2026-02-25 17:53:16.787	cmm2c1vj0000004jxlw14qzhm
\.


--
-- Data for Name: Payment; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."Payment" (id, "invoiceId", "tenantId", amount, method, status, "slipUrl", "slipVerified", "verifiedAt", "verifiedBy", "checkNo", "checkBank", "checkDate", "transferRef", "transferBank", notes, "paidAt", "createdAt", "updatedAt", "invoiceDate", "invoiceNo", "invoiceTotalAmount", "tenantName", "tenantNameTh", "tenantType") FROM stdin;
\.


--
-- Data for Name: PaymentSlip; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."PaymentSlip" (id, "paymentId", "s3Key", "fileName", "contentType", "uploadedAt", "uploadedBy", source) FROM stdin;
\.


--
-- Data for Name: Project; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."Project" (id, name, "nameTh", description, address, type, "ownerId", "billingDay", "electricityRate", "waterRate", "taxId", "companyName", "companyNameTh", "companyAddress", "lineChannelId", "lineChannelSecret", "lineAccessToken", "createdAt", "updatedAt", "liffId", "bankAccountName", "bankAccountNumber", "bankName", "logoUrl", "lineOaId") FROM stdin;
cmlen9ti6000004kyd1n0kqrq	BizSpace 56		\N		WAREHOUSE	cml3rd0qn0000eigsqrodzp2b	28	6.5	20					2009081526	b27d2e4016bc0c19c0f6643d72e69f5f	guibmn2Ht1FsTs2FcLmTz3hy76Gc3mJ32pAze67yPYZ+d40AXIvrpbsXBWk/RC0/uihiuwYFeIMV1iIvl0gA6TRYO0R8c8dWgWy7nmCM0bpUiGUAds4p/ELK6Qlb/DGBmHL9SrCSWDE+GXqADVh44gdB04t89/1O/w1cDnyilFU=	2026-02-09 04:00:54.942	2026-02-09 04:08:05.756	\N					\N
cmlenip02000004ju1lapov3k	BizSpace 15		\N		WAREHOUSE	cml3rd0qn0000eigsqrodzp2b	28	6.5	20	\N	\N	\N	\N	2009081526	b27d2e4016bc0c19c0f6643d72e69f5f	guibmn2Ht1FsTs2FcLmTz3hy76Gc3mJ32pAze67yPYZ+d40AXIvrpbsXBWk/RC0/uihiuwYFeIMV1iIvl0gA6TRYO0R8c8dWgWy7nmCM0bpUiGUAds4p/ELK6Qlb/DGBmHL9SrCSWDE+GXqADVh44gdB04t89/1O/w1cDnyilFU=	2026-02-09 04:07:49.01	2026-02-09 04:09:16.428	\N	\N	\N	\N	\N	\N
\.


--
-- Data for Name: Receipt; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."Receipt" (id, "receiptNo", "invoiceId", amount, "issuedAt", "sentViaLine", "sentAt", "pdfUrl", "createdAt", "updatedAt", "invoiceDate", "invoiceNo", "invoiceTotalAmount", "tenantName", "tenantNameTh", "tenantTaxId", "tenantType") FROM stdin;
\.


--
-- Data for Name: Session; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."Session" (id, "sessionToken", "userId", expires) FROM stdin;
\.


--
-- Data for Name: Tenant; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."Tenant" (id, "unitId", name, "nameTh", email, phone, "idCard", "taxId", "tenantType", "withholdingTax", "lineUserId", "contractStart", "contractEnd", "createdAt", "updatedAt", "baseRent", "commonFee", deposit, "discountAmount", "discountPercent", "electricMeterNo", "waterMeterNo", address, "imageUrl") FROM stdin;
cmlfzimo8000104k16t396604	cmleqlsow000304jym8c3xnd5	บริษัท ดอทแทมป์ จำกัด	บริษัท ดอทแทมป์ จำกัด	\N	\N	\N	0105562004118	COMPANY	5	\N	2025-11-01 00:00:00	2028-10-31 00:00:00	2026-02-10 02:31:27.558	2026-02-10 02:31:27.558	29473.68	\N	\N	0	0	\N	\N	\N	\N
cmlfzmoh2000004kvgz8dakfy	cmleqmf0q000004ld9qfxow4m	บริษัท เซทเลอร์ โฟร์อีเว้น จำกัด	บริษัท เซทเลอร์ โฟร์อีเว้น จำกัด	\N	\N	\N	0105561103732	COMPANY	5	\N	2025-05-01 00:00:00	2028-04-30 00:00:00	2026-02-10 02:34:36.514	2026-02-10 02:34:36.514	29473.68	\N	\N	0	0	\N	\N	\N	\N
cmlfzqafw000204k1z1kj68mo	cmleqowny000004lcvm4q8d10	บริษัท ปาป๋ามาดู จำกัด	บริษัท ปาป๋ามาดู จำกัด	\N	\N	\N	0205561007627	COMPANY	5	\N	2025-05-01 00:00:00	2028-04-30 00:00:00	2026-02-10 02:37:24.953	2026-02-10 02:37:24.953	42105.26	\N	\N	0	0	\N	\N	\N	\N
cmlfzt4n6000204jo7b2hdchb	cmleqqdl4000004iimqkp7bi4	บริษัท ณายลอย เบเกอรี่ จำกัด	บริษัท ณายลอย เบเกอรี่ จำกัด	\N	\N	\N	0105557091822	COMPANY	5	\N	2025-07-01 00:00:00	2028-06-30 00:00:00	2026-02-10 02:39:37.407	2026-02-10 02:39:37.407	42105.26	\N	\N	0	0	\N	\N	\N	\N
cmlfzxaxm000104kvq39y45m2	cmleqr6f1000004ldzb04n1i1	บริษัท สยาม โกลด์ ฟิกเกอร์ เซอร์วิส จำกัด	บริษัท สยาม โกลด์ ฟิกเกอร์ เซอร์วิส จำกัด (สำนักงานใหญ่)	\N	\N	\N	0105547054711	COMPANY	5	\N	2025-07-01 00:00:00	2028-06-30 00:00:00	2026-02-10 02:42:52.184	2026-02-10 02:42:52.184	42105.26	\N	\N	0	0	\N	\N	\N	\N
cmlg01op5000204kvkjz9x7jt	cmleqs8qj000104ld4yjrm9sx	บริษัท วิรารัณ สตูดิโอ จำกัด 	บริษัท วิรารัณ สตูดิโอ จำกัด 	\N	\N	\N	0105568051720	COMPANY	5	\N	2025-07-01 00:00:00	2028-06-30 00:00:00	2026-02-10 02:46:16.647	2026-02-10 02:46:16.647	42105.26	\N	\N	0	0	\N	\N	\N	\N
cmlg05k7t000304k1pegbjd6f	cmleqt76n000004l7ehto8h66	นาย ณัฐคเณศ อมฤตกร	นาย ณัฐคเณศ อมฤตกร	\N	0911881998	3309901100595	\N	INDIVIDUAL	0	\N	2025-05-01 00:00:00	2028-04-30 00:00:00	2026-02-10 02:49:17.463	2026-02-10 02:49:17.463	42000	\N	\N	0	0	\N	\N	\N	\N
cmlg0p55h000304jo6rj84m2y	cmler23nj000004l2g60yp2z3	บริษัท ธิงค์ ออฟ ซิม จำกัด	บริษัท ธิงค์ ออฟ ซิม จำกัด	\N	\N	\N	0105562185384	COMPANY	5	\N	2025-12-01 00:00:00	2028-11-30 00:00:00	2026-02-10 03:04:31.059	2026-02-10 03:04:31.059	69473.68	\N	\N	0	0	\N	\N	\N	\N
cmlg0t3z1000404k14gepc2ov	cmler2s4h000004l7mpi18z27	บริษัท มาดามลิซ่า จำกัด (สำนักงานใหญ่)	บริษัท มาดามลิซ่า จำกัด (สำนักงานใหญ่)	\N	\N	\N	0105555096525	COMPANY	5	\N	2025-12-01 00:00:00	2028-11-30 00:00:00	2026-02-10 03:07:36.154	2026-02-10 03:07:36.154	36842.11	\N	\N	0	0	\N	\N	\N	\N
cmlg0w6vr000404jola9gz164	cmler3khi000104l7dn26uioa	บริษัท ไทย ซุยา จำกัด	บริษัท ไทย ซุยา จำกัด	\N	\N	\N	0105563064068	COMPANY	5	\N	2025-12-01 00:00:00	2028-11-30 00:00:00	2026-02-10 03:09:59.893	2026-02-10 03:09:59.893	36842.11	\N	\N	0	0	\N	\N	\N	\N
cmlg10b3c000504k1sn28aabl	cmler491c000204l74jzisyt2	บริษัท ทรี เค ดิสทริบิวชั่น จำกัด (สำนักงานใหญ่)	บริษัท ทรี เค ดิสทริบิวชั่น จำกัด (สำนักงานใหญ่)	\N	\N	\N	0125561004262	COMPANY	5	\N	2025-12-01 00:00:00	2028-11-30 00:00:00	2026-02-10 03:13:11.974	2026-02-10 03:13:11.974	36842.11	\N	\N	0	0	\N	\N	\N	\N
cmler8qo8000104lcaoio6xfw	cmleqiwez000004jyut9udiq8	CAM TECH SOUTHEAST ASIA CO.,LTD	\N	\N	\N	\N	0105567017897	COMPANY	5	\N	2025-06-01 00:00:00	2029-05-31 00:00:00	2026-02-09 05:52:03.078	2026-02-09 13:58:47.721	29473.68	\N	56000	0	0	\N	\N	Warehouse C1, 139/1 Soi Nawamin 56 Nawamin Subdistrict, Bueng Kum District, Bangkok 10230	\N
cmlfz3ay5000004joquvbpss8	cmleqj3xg000004l1virst11d	บริษัท โซลูชั่นส์ เมคเกอร์ จำกัด	บริษัท โซลูชั่นส์ เมคเกอร์ จำกัด	\N	\N	\N	0105557031030	COMPANY	5	\N	2025-12-01 00:00:00	2028-11-30 00:00:00	2026-02-10 02:19:32.521	2026-02-10 02:19:32.521	29473.68	\N	\N	0	0	\N	\N	\N	\N
cmlfzaz75000004k1axg7ir3b	cmleqk1a2000104jy5iughvxk	บริษัท อีเนอเร็คซ์ จำกัด	บริษัท อีเนอเร็คซ์ จำกัด	\N	\N	\N	0105547092222	COMPANY	5	\N	2025-06-01 00:00:00	2028-05-31 00:00:00	2026-02-10 02:25:30.542	2026-02-10 02:25:30.542	29473.68	\N	\N	0	0	\N	\N	\N	\N
cmlfzfamy000104joevr32dcr	cmleql1kq000204jy89mxtg1x	บริษัท พี ทเวนตี้ไนน์ อินทีเรีย ดีไซน์ จำกัด	บริษัท พี ทเวนตี้ไนน์ อินทีเรีย ดีไซน์ จำกัด	\N	\N	\N	0105564113402	COMPANY	5	\N	2025-05-01 00:00:00	2028-04-30 00:00:00	2026-02-10 02:28:51.992	2026-02-10 02:28:51.992	29473.68	\N	\N	0	0	\N	\N	\N	\N
\.


--
-- Data for Name: Unit; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."Unit" (id, "projectId", "unitNumber", floor, size, type, status, "positionX", "positionY", width, height, "createdAt", "updatedAt") FROM stdin;
cmleqqdl4000004iimqkp7bi4	cmlen9ti6000004kyd1n0kqrq	C8	1	180	WAREHOUSE	OCCUPIED	480	240	70	100	2026-02-09 05:37:46.309	2026-02-22 16:13:21.648
cmleqlsow000304jym8c3xnd5	cmlen9ti6000004kyd1n0kqrq	C5	1	120	WAREHOUSE	OCCUPIED	280	240	60	100.7142857142857	2026-02-09 05:34:12.606	2026-02-22 16:13:21.679
cmleqk1a2000104jy5iughvxk	cmlen9ti6000004kyd1n0kqrq	C3	1	120	WAREHOUSE	OCCUPIED	140	240	60	101.4285714285714	2026-02-09 05:32:50.424	2026-02-22 16:13:22.551
cmleqs8qj000104ld4yjrm9sx	cmlen9ti6000004kyd1n0kqrq	C10	1	180	WAREHOUSE	OCCUPIED	640	240	70	100	2026-02-09 05:39:13.337	2026-02-22 16:13:22.668
cmleqt76n000004l7ehto8h66	cmlen9ti6000004kyd1n0kqrq	C11	1	180	WAREHOUSE	OCCUPIED	730	240	70	100	2026-02-09 05:39:57.981	2026-02-22 16:13:22.679
cmleqiwez000004jyut9udiq8	cmlen9ti6000004kyd1n0kqrq	C1	1	120	WAREHOUSE	OCCUPIED	20	240	60	101	2026-02-09 05:31:57.46	2026-02-22 16:13:22.697
cmleqmf0q000004ld9qfxow4m	cmlen9ti6000004kyd1n0kqrq	C6	1	120	WAREHOUSE	OCCUPIED	330	240	60	99.99999999999999	2026-02-09 05:34:41.541	2026-02-22 16:13:22.706
cmler23nj000004l2g60yp2z3	cmlenip02000004ju1lapov3k	J1/J2	1	240	WAREHOUSE	OCCUPIED	450	240	140	100	2026-02-09 05:46:53.309	2026-02-10 03:04:31.079
cmler2s4h000004l7mpi18z27	cmlenip02000004ju1lapov3k	J3	1	120	WAREHOUSE	OCCUPIED	360	240	70	100	2026-02-09 05:47:25.023	2026-02-10 03:07:36.172
cmler3khi000104l7dn26uioa	cmlenip02000004ju1lapov3k	J4	1	120	WAREHOUSE	OCCUPIED	290	240	70	100	2026-02-09 05:48:01.78	2026-02-10 03:09:59.912
cmler491c000204l74jzisyt2	cmlenip02000004ju1lapov3k	J5	1	120	WAREHOUSE	OCCUPIED	220	240	70	100	2026-02-09 05:48:33.598	2026-02-10 03:13:11.99
cmleql1kq000204jy89mxtg1x	cmlen9ti6000004kyd1n0kqrq	C4	1	120	WAREHOUSE	OCCUPIED	220	240	60	100.7142857142857	2026-02-09 05:33:37.462	2026-02-22 16:13:21.584
cmleqr6f1000004ldzb04n1i1	cmlen9ti6000004kyd1n0kqrq	C9	1	180	WAREHOUSE	OCCUPIED	570	240	70	100	2026-02-09 05:38:23.674	2026-02-22 16:13:21.586
cmleqj3xg000004l1virst11d	cmlen9ti6000004kyd1n0kqrq	C2	1	120	WAREHOUSE	OCCUPIED	80	240	60	101	2026-02-09 05:32:07.202	2026-02-22 16:13:21.635
cmleqowny000004lcvm4q8d10	cmlen9ti6000004kyd1n0kqrq	C7	1	180	WAREHOUSE	OCCUPIED	410	240	70	100	2026-02-09 05:36:37.724	2026-02-22 16:13:21.639
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."User" (id, name, email, "emailVerified", password, image, role, "createdAt", "updatedAt") FROM stdin;
cml3rd0qn0000eigsqrodzp2b	winniw	winnie@gmail.com	\N	$2b$10$AK4K8lpEep7CHgw/KzPF3O/uvCRMoG7PnHAmTJ6BOy6ZI.BuFrod2	\N	OWNER	2026-02-01 13:09:54.815	2026-02-01 13:09:54.815
cml6s5vok000004ldsq9hn9yk	aoy	aoy@gmail.com	\N	$2b$12$Xr7S0sS0LLgHqe1ONu4kQeUrr4gIeNKB3CiBdFdpxw602DXzCNtcG	\N	OWNER	2026-02-03 15:55:39.812	2026-02-03 15:55:39.812
cml6ta5g0000004l87u7ojlsk	AlYiLdCIYqkDlrlonqbh	m.u.m.i.pat.os.e.ha15@gmail.com	\N	$2b$12$Gq6ZjjcAw438PyEkE2u67en1dPPOJqBkvKeiL../pjSoYehpZCdly	\N	OWNER	2026-02-03 16:26:58.703	2026-02-03 16:26:58.703
cmlduiuxm000004jmuahbejzo	test	test@gmail.com	\N	$2b$12$5.n4fjwiYO74bkTfZruHKuAHmxfu3C/zEg9gyUPEnfYlkFMnpN2ju	\N	OWNER	2026-02-08 14:36:07.833	2026-02-08 14:36:07.833
cmln7rdpm000004jrq8ecwts2	QxTtJHIXgXWrcAvUgIXqGILe	na.kov.o.ca.sa25@gmail.com	\N	$2b$12$3im6uVSg.jhNVaGOHfvpRuoTYpUHSLNEWnrVrnNvwJakwKQ4grQ2y	\N	OWNER	2026-02-15 03:56:36.01	2026-02-15 03:56:36.01
\.


--
-- Data for Name: VerificationToken; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."VerificationToken" (identifier, token, expires) FROM stdin;
\.


--
-- Name: Account Account_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Account"
    ADD CONSTRAINT "Account_pkey" PRIMARY KEY (id);


--
-- Name: FloorPlan FloorPlan_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."FloorPlan"
    ADD CONSTRAINT "FloorPlan_pkey" PRIMARY KEY (id);


--
-- Name: Invoice Invoice_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Invoice"
    ADD CONSTRAINT "Invoice_pkey" PRIMARY KEY (id);


--
-- Name: LeaseContract LeaseContract_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."LeaseContract"
    ADD CONSTRAINT "LeaseContract_pkey" PRIMARY KEY (id);


--
-- Name: LineContact LineContact_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."LineContact"
    ADD CONSTRAINT "LineContact_pkey" PRIMARY KEY (id);


--
-- Name: LineMessage LineMessage_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."LineMessage"
    ADD CONSTRAINT "LineMessage_pkey" PRIMARY KEY (id);


--
-- Name: LineOA LineOA_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."LineOA"
    ADD CONSTRAINT "LineOA_pkey" PRIMARY KEY (id);


--
-- Name: MaintenanceRequest MaintenanceRequest_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."MaintenanceRequest"
    ADD CONSTRAINT "MaintenanceRequest_pkey" PRIMARY KEY (id);


--
-- Name: MeterReading MeterReading_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."MeterReading"
    ADD CONSTRAINT "MeterReading_pkey" PRIMARY KEY (id);


--
-- Name: PaymentSlip PaymentSlip_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."PaymentSlip"
    ADD CONSTRAINT "PaymentSlip_pkey" PRIMARY KEY (id);


--
-- Name: Payment Payment_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Payment"
    ADD CONSTRAINT "Payment_pkey" PRIMARY KEY (id);


--
-- Name: Project Project_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Project"
    ADD CONSTRAINT "Project_pkey" PRIMARY KEY (id);


--
-- Name: Receipt Receipt_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Receipt"
    ADD CONSTRAINT "Receipt_pkey" PRIMARY KEY (id);


--
-- Name: Session Session_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Session"
    ADD CONSTRAINT "Session_pkey" PRIMARY KEY (id);


--
-- Name: Tenant Tenant_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Tenant"
    ADD CONSTRAINT "Tenant_pkey" PRIMARY KEY (id);


--
-- Name: Unit Unit_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Unit"
    ADD CONSTRAINT "Unit_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: Account_provider_providerAccountId_key; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON public."Account" USING btree (provider, "providerAccountId");


--
-- Name: FloorPlan_projectId_floor_key; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX "FloorPlan_projectId_floor_key" ON public."FloorPlan" USING btree ("projectId", floor);


--
-- Name: Invoice_invoiceNo_key; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX "Invoice_invoiceNo_key" ON public."Invoice" USING btree ("invoiceNo");


--
-- Name: LeaseContract_contractNo_key; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX "LeaseContract_contractNo_key" ON public."LeaseContract" USING btree ("contractNo");


--
-- Name: LeaseContract_signingToken_key; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX "LeaseContract_signingToken_key" ON public."LeaseContract" USING btree ("signingToken");


--
-- Name: LineContact_tenantId_key; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX "LineContact_tenantId_key" ON public."LineContact" USING btree ("tenantId");


--
-- Name: Receipt_invoiceId_key; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX "Receipt_invoiceId_key" ON public."Receipt" USING btree ("invoiceId");


--
-- Name: Receipt_receiptNo_key; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX "Receipt_receiptNo_key" ON public."Receipt" USING btree ("receiptNo");


--
-- Name: Session_sessionToken_key; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX "Session_sessionToken_key" ON public."Session" USING btree ("sessionToken");


--
-- Name: Unit_projectId_unitNumber_key; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX "Unit_projectId_unitNumber_key" ON public."Unit" USING btree ("projectId", "unitNumber");


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: VerificationToken_identifier_token_key; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON public."VerificationToken" USING btree (identifier, token);


--
-- Name: VerificationToken_token_key; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX "VerificationToken_token_key" ON public."VerificationToken" USING btree (token);


--
-- Name: Account Account_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Account"
    ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: FloorPlan FloorPlan_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."FloorPlan"
    ADD CONSTRAINT "FloorPlan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public."Project"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Invoice Invoice_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Invoice"
    ADD CONSTRAINT "Invoice_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public."Project"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Invoice Invoice_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Invoice"
    ADD CONSTRAINT "Invoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Invoice Invoice_unitId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Invoice"
    ADD CONSTRAINT "Invoice_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES public."Unit"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: LeaseContract LeaseContract_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."LeaseContract"
    ADD CONSTRAINT "LeaseContract_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public."Project"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: LeaseContract LeaseContract_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."LeaseContract"
    ADD CONSTRAINT "LeaseContract_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: LeaseContract LeaseContract_unitId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."LeaseContract"
    ADD CONSTRAINT "LeaseContract_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES public."Unit"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: LineContact LineContact_lineOaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."LineContact"
    ADD CONSTRAINT "LineContact_lineOaId_fkey" FOREIGN KEY ("lineOaId") REFERENCES public."LineOA"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: LineContact LineContact_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."LineContact"
    ADD CONSTRAINT "LineContact_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public."Project"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: LineContact LineContact_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."LineContact"
    ADD CONSTRAINT "LineContact_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: LineMessage LineMessage_lineContactId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."LineMessage"
    ADD CONSTRAINT "LineMessage_lineContactId_fkey" FOREIGN KEY ("lineContactId") REFERENCES public."LineContact"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: LineOA LineOA_ownerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."LineOA"
    ADD CONSTRAINT "LineOA_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MaintenanceRequest MaintenanceRequest_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."MaintenanceRequest"
    ADD CONSTRAINT "MaintenanceRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public."Project"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MaintenanceRequest MaintenanceRequest_unitId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."MaintenanceRequest"
    ADD CONSTRAINT "MaintenanceRequest_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES public."Unit"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MeterReading MeterReading_invoiceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."MeterReading"
    ADD CONSTRAINT "MeterReading_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES public."Invoice"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: MeterReading MeterReading_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."MeterReading"
    ADD CONSTRAINT "MeterReading_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public."Project"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MeterReading MeterReading_unitId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."MeterReading"
    ADD CONSTRAINT "MeterReading_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES public."Unit"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PaymentSlip PaymentSlip_paymentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."PaymentSlip"
    ADD CONSTRAINT "PaymentSlip_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES public."Payment"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Payment Payment_invoiceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Payment"
    ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES public."Invoice"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Payment Payment_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Payment"
    ADD CONSTRAINT "Payment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Project Project_lineOaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Project"
    ADD CONSTRAINT "Project_lineOaId_fkey" FOREIGN KEY ("lineOaId") REFERENCES public."LineOA"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Project Project_ownerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Project"
    ADD CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Receipt Receipt_invoiceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Receipt"
    ADD CONSTRAINT "Receipt_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES public."Invoice"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Session Session_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Session"
    ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Tenant Tenant_unitId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Tenant"
    ADD CONSTRAINT "Tenant_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES public."Unit"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Unit Unit_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Unit"
    ADD CONSTRAINT "Unit_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public."Project"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO neon_superuser WITH GRANT OPTION;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON TABLES TO neon_superuser WITH GRANT OPTION;


--
-- PostgreSQL database dump complete
--

\unrestrict AQaXGdZJDgriBjyIWoqLivQK5Axki0d8EXH0L1GYCVMUEFMW6ghiPIwNejQJOC2

