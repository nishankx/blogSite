export function requireAdminAuth(req, res, next) {
    const adminKey = process.env.ADMIN_SECRET_KEY;

    if (!adminKey) {
        console.warn("WARNING: ADMIN_SECRET_KEY is not defined in environment variables!");
    }

    const authHeader = req.headers.authorization;
    const customHeader = req.headers['x-admin-key'];

    const bearerToken = authHeader && authHeader.startsWith('Bearer ') 
        ? authHeader.split(' ')[1] 
        : null;

    const providedKey = bearerToken || customHeader;

    if (!providedKey || providedKey !== adminKey) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized: Admin access required",
        });
    }

    req.isAdmin = true;
    next();
}
