import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";
import { supabaseAdmin } from "../../../lib/server/supabaseAdmin.js";
import { hashToken } from "../../../lib/server/tokens.js";
import { sendEmailNotification } from "../../../lib/server/sendEmail.js";
