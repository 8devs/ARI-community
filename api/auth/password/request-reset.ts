import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";
import { supabaseAdmin } from "../../../lib/server/supabaseAdmin";
import { hashToken } from "../../../lib/server/tokens";
import { sendEmailNotification } from "../../../lib/server/sendEmail";
