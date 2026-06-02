import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

import { createDb, schema } from ".";

const DEFAULT_ADMIN_EMAIL = "admin@crm.com";
const DEFAULT_ADMIN_PASSWORD = "admin123";
const DEFAULT_ADMIN_NAME = "Admin";

async function main() {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
        console.error("DATABASE_URL is not set");
        process.exit(1);
    }

    const db = createDb(databaseUrl);

    const salt = await bcrypt.genSalt(10);
    const adminHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, salt);

    const [existingAdmin] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, DEFAULT_ADMIN_EMAIL));

    if (existingAdmin) {
        await db
            .update(schema.users)
            .set({
                name: DEFAULT_ADMIN_NAME,
                passwordHash: adminHash,
                role: "admin",
                departmentId: null,
            })
            .where(eq(schema.users.id, existingAdmin.id));

        console.log(
            `Admin user with email ${DEFAULT_ADMIN_EMAIL} already exists. Password and role reset.`,
        );
    } else {
        await db.insert(schema.users).values({
            name: DEFAULT_ADMIN_NAME,
            email: DEFAULT_ADMIN_EMAIL,
            passwordHash: adminHash,
            role: "admin",
            departmentId: null,
        });

        console.log(
            `Admin user created with email ${DEFAULT_ADMIN_EMAIL} and default password.`,
        );
    }

    console.log(
        "\nSign-in (same /login for everyone): admin → " +
            DEFAULT_ADMIN_EMAIL +
            " / " +
            DEFAULT_ADMIN_PASSWORD +
            "\n",
    );
}

main()
    .then(() => {
        console.log("Database seed completed successfully.");
        process.exit(0);
    })
    .catch((error) => {
        console.error("Database seed failed:", error);
        process.exit(1);
    });
