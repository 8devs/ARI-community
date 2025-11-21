import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";
import { supabaseAdmin } from "../../../_lib/supabaseAdmin";
import { hashToken } from "../../../_lib/tokens";
import { sendEmailNotification } from "../../_lib/sendEmail";
