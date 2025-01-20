import chalk from 'chalk';

type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'success';

interface LogOptions {
    timestamp?: boolean;
    prefix?: string;
}

class Logger {
    private static writeStream = process.stdout;
    private static errorStream = process.stderr;

    private static getTimestamp(): string {
        return new Date().toISOString();
    }

    private static formatMessage(message: string, level: LogLevel, options?: LogOptions): string {
        const parts: string[] = [];

        if (options?.timestamp) {
            parts.push(chalk.gray(this.getTimestamp()));
        }

        const levelColor = {
            info: chalk.blue('INFO'),
            warn: chalk.yellow('WARN'),
            error: chalk.red('ERROR'),
            debug: chalk.magenta('DEBUG'),
            success: chalk.green('SUCCESS')
        };

        parts.push(levelColor[level]);

        if (options?.prefix) {
            parts.push(chalk.cyan(`[${options.prefix}]`));
        }

        const messageColor = {
            info: chalk.white,
            warn: chalk.yellow,
            error: chalk.red,
            debug: chalk.gray,
            success: chalk.green
        };

        parts.push(messageColor[level](message));

        return parts.join(' ') + '\n';
    }

    private static write(message: string, level: LogLevel, options?: LogOptions): void {
        const formattedMessage = this.formatMessage(message, level, options);
        if (level === 'error' || level === 'warn') {
            this.errorStream.write(formattedMessage);
        } else {
            this.writeStream.write(formattedMessage);
        }
    }

    static info(message: string, options?: LogOptions): void {
        this.write(message, 'info', options);
    }

    static warn(message: string, options?: LogOptions): void {
        this.write(message, 'warn', options);
    }

    static error(message: string | Error, options?: LogOptions): void {
        const errorMessage = message instanceof Error ? message.stack || message.message : message;
        this.write(errorMessage, 'error', options);
    }

    static debug(message: string, options?: LogOptions): void {
        if (process.env.NODE_ENV !== 'production') {
            this.write(message, 'debug', options);
        }
    }

    static success(message: string, options?: LogOptions): void {
        this.write(message, 'success', options);
    }
}

export default Logger;