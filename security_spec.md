# Firestore Security Specification

This document details the security model, invariants, and test payload assertions for the Ayumi Asset Shop Firestore database.

## 1. Data Invariants
1. **Admins** (`/admins/{adminId}`): Contains username and SHA-256 hashed passwords. These cannot be written or altered by arbitrary clients.
2. **Assets** (`/assets/{assetId}`): Can be read by any public customer. Can only be created, modified, or deleted by authenticated administrators.
3. **Values Checks**: Asset prices must be valid numbers >= 0. Custom string lengths and types must be strictly constrained to avoid wallet exhaustion or database pollution.

## 2. The Dirty Dozen Payloads
Below are 12 specific payloads representing hostile attempts to bypass our rules:
1. **Unauthenticated write to Admins collection** - Trying to register a new admin.
2. **Unauthenticated write to Assets collection** - Trying to list a raw or fake asset.
3. **Spoofed creator ID** - Overriding `id` field on write.
4. **Invalid prices** - Setting a negative asset price (e.g. `-100.00`).
5. **Huge string injection** - Flooding the description or name with a 1MB string.
6. **Altering admin list as guest** - Deleting admin records.
7. **Modifying an asset without administrative auth token** - Crafting guest updates.
8. **Bypassing Category validations** - Injecting custom malicious category groups.
9. **Zero-length name injection** - Creating empty nameless assets.
10. **Admin identity theft** - Writing to another admin record.
11. **Altering immortal fields** - Overwriting `createdAt` timestamps with future dates.
12. **Tampering locks** - Forcing non-whitelisted keys into the object during standard asset updation.

## 3. Test Runner Definition
These tests prove that any malicious client request gets rejected synchronously with a `PERMISSION_DENIED` status.
