--
-- PostgreSQL database dump
--

\restrict WP1aPTEHXnEIThV56mNCF2gVcjBFb1RQyBXcugrFXwi4GruhjZWgtRxiEmHG4iI

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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: account_monthly_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_monthly_usage (
    account_id uuid NOT NULL,
    usage_month date NOT NULL,
    consumed_units bigint DEFAULT 0 NOT NULL,
    CONSTRAINT account_monthly_usage_consumed_units_check CHECK ((consumed_units >= 0))
);


--
-- Name: accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(150) NOT NULL,
    api_key_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    plan_id uuid
);


--
-- Name: plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    plan_type character varying(20) NOT NULL,
    monthly_allowance bigint NOT NULL,
    max_units_per_request bigint NOT NULL,
    is_predefined boolean DEFAULT false NOT NULL,
    owner_account_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT plans_check CHECK ((((is_predefined = true) AND (owner_account_id IS NULL)) OR ((is_predefined = false) AND (owner_account_id IS NOT NULL)))),
    CONSTRAINT plans_max_units_per_request_check CHECK ((max_units_per_request > 0)),
    CONSTRAINT plans_monthly_allowance_check CHECK ((monthly_allowance >= 0)),
    CONSTRAINT plans_plan_type_check CHECK (((plan_type)::text = ANY ((ARRAY['account'::character varying, 'user'::character varying])::text[])))
);


--
-- Name: usage_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usage_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid NOT NULL,
    user_id uuid NOT NULL,
    request_id character varying(200) NOT NULL,
    units bigint NOT NULL,
    status character varying(20) NOT NULL,
    rejection_scope character varying(20),
    rejection_reason text,
    usage_month date NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT usage_requests_check CHECK (((((status)::text = 'accepted'::text) AND (rejection_scope IS NULL) AND (rejection_reason IS NULL)) OR (((status)::text = 'rejected'::text) AND (rejection_scope IS NOT NULL) AND (rejection_reason IS NOT NULL)))),
    CONSTRAINT usage_requests_rejection_scope_check CHECK (((rejection_scope)::text = ANY ((ARRAY['account'::character varying, 'user'::character varying])::text[]))),
    CONSTRAINT usage_requests_status_check CHECK (((status)::text = ANY ((ARRAY['accepted'::character varying, 'rejected'::character varying])::text[]))),
    CONSTRAINT usage_requests_units_check CHECK ((units > 0))
);


--
-- Name: user_monthly_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_monthly_usage (
    user_id uuid NOT NULL,
    usage_month date NOT NULL,
    consumed_units bigint DEFAULT 0 NOT NULL,
    CONSTRAINT user_monthly_usage_consumed_units_check CHECK ((consumed_units >= 0))
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid NOT NULL,
    external_user_id character varying(150) NOT NULL,
    plan_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: account_monthly_usage account_monthly_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_monthly_usage
    ADD CONSTRAINT account_monthly_usage_pkey PRIMARY KEY (account_id, usage_month);


--
-- Name: accounts accounts_api_key_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_api_key_hash_key UNIQUE (api_key_hash);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: plans plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_pkey PRIMARY KEY (id);


--
-- Name: usage_requests usage_requests_account_id_request_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_requests
    ADD CONSTRAINT usage_requests_account_id_request_id_key UNIQUE (account_id, request_id);


--
-- Name: usage_requests usage_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_requests
    ADD CONSTRAINT usage_requests_pkey PRIMARY KEY (id);


--
-- Name: user_monthly_usage user_monthly_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_monthly_usage
    ADD CONSTRAINT user_monthly_usage_pkey PRIMARY KEY (user_id, usage_month);


--
-- Name: users users_account_id_external_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_account_id_external_user_id_key UNIQUE (account_id, external_user_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_usage_requests_account_history; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usage_requests_account_history ON public.usage_requests USING btree (account_id, created_at DESC, id DESC);


--
-- Name: idx_usage_requests_user_history; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usage_requests_user_history ON public.usage_requests USING btree (user_id, created_at DESC, id DESC);


--
-- Name: account_monthly_usage account_monthly_usage_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_monthly_usage
    ADD CONSTRAINT account_monthly_usage_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id);


--
-- Name: accounts accounts_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id);


--
-- Name: plans plans_owner_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_owner_account_id_fkey FOREIGN KEY (owner_account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: usage_requests usage_requests_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_requests
    ADD CONSTRAINT usage_requests_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id);


--
-- Name: usage_requests usage_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_requests
    ADD CONSTRAINT usage_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: user_monthly_usage user_monthly_usage_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_monthly_usage
    ADD CONSTRAINT user_monthly_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: users users_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id);


--
-- Name: users users_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id);


--
-- PostgreSQL database dump complete
--

\unrestrict WP1aPTEHXnEIThV56mNCF2gVcjBFb1RQyBXcugrFXwi4GruhjZWgtRxiEmHG4iI

