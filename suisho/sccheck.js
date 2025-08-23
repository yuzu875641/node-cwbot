// ============================
// セキュリティチェック用
// ============================

const crypto = require('crypto');

class SignatureChecker {
    constructor(token) {
        this.secretKey = Buffer.from(token, 'base64');
    }

    async verifyCWSign(requestBody, receivedSignature) {
        const hmac = crypto.createHmac('sha256', this.secretKey);
        const digest = hmac.update(requestBody).digest('base64');

        return digest === receivedSignature;
    }
}

module.exports = SignatureChecker;
