import * as jose from "jose";

export function randomString(length: number): string {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = length; i > 0; --i) result += chars[Math.floor(Math.random() * chars.length)];
    return result;
}

interface JwtUser {
    name: string
    email: string
    phoneNumber: string
    isValid: boolean
}


export async function validateJwt(token: string, jwksUrl: string): Promise<JwtUser> {
    const jwks = jose.createRemoteJWKSet(new URL(jwksUrl))

    try {
        const { payload } = await jose.jwtVerify(token, jwks, {
            algorithms: ["RS256"],
        });

        let name = ""
        let email = ""
        let phoneNumber = ""

        if (Object.hasOwn(payload, 'http://sagebrushgis.com/phone_number' )) {
            phoneNumber = payload['http://sagebrushgis.com/phone_number'] as string
        }

        if (Object.hasOwn(payload, 'http://sagebrushgis.com/name' )) {
            name = payload['http://sagebrushgis.com/name'] as string
        }

        if (Object.hasOwn(payload, 'http://sagebrushgis.com/email' )) {
            email = payload['http://sagebrushgis.com/email'] as string
        }
        return {
            name: name,
            email:  email,
            phoneNumber:  phoneNumber,
            isValid: true,
        }
    } catch {
        return {
            name: "",
            email:  "",
            phoneNumber:  "",
            isValid: false,
        }
    }
}
