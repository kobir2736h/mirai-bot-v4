const chalk = require('chalk');

module.exports = (data, type) => {
    switch (type) {
        case 'warn':
            // ম্যাজেন্টা কালারে ওয়ার্নিং দেখাবে
            console.log(chalk.bold.hex('#FF00FF')('[ Warn ] » ') + data);
            break;
        case 'error':
            // লাল কালারে এরর দেখাবে
            console.log(chalk.bold.hex('#ff334b')('[ Error ] » ') + data);
            break;
        default:
            // অন্য সব মেসেজ লাল কালারে
            console.log(chalk.bold.hex('#FF0000')(type + ' » ') + data);
            break;
    }
}

module.exports.loader = (data, type) => {
    switch (type) {
        case 'warn':
            // এখানে নিজের নাম বা ক্রেডিট দেখাবে
            console.log(chalk.bold.hex('#b4ff33')('[ Kawsar ] » ') + data);
            break;
        case 'error':
            console.log(chalk.bold.hex('#ff334b')('[ Error ] » ') + data);
            break;
        default:
            console.log(chalk.bold.hex('#33ffc9')('[ Kawsar ] » ') + data);
            break;
    }
}
