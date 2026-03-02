import jwt from "jsonwebtoken"

const generateTokenAndSetCookie = (user, res) => {
    const token = jwt.sign({
        userId: user._id,
        role: user.role,
        email: user.email,
        name: user.name
    }, process.env.JWT_SECRET, {
        expiresIn: "30d"
    })

    res.cookie("jwt", token, {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: "none",
        secure: true
    })

    return token
}

export default generateTokenAndSetCookie