package log

import (
	"fmt"
	"io"
	"os"
	"sync"
	"time"
)

type LogLevel int

const (
	Debug LogLevel = iota
	Info
	Warn
	Error
	Fatal
)

var levelColors = map[LogLevel]string{
	Debug: "\033[36m", // Cyan
	Info:  "\033[32m", // Green
	Warn:  "\033[33m", // Yellow
	Error: "\033[31m", // Red
	Fatal: "\033[35m", // Magenta
}

type Log struct {
	Level     LogLevel
	TimeStamp time.Time
	Message   string
	Context   map[string]interface{}
}

type LogOptions struct {
	Level         LogLevel
	ShowTimeStamp bool
	TimeFormat    string
	Output        io.Writer
	UseColors     bool
}

type option func(*LogOptions)

type Logger struct {
	options LogOptions
	mu      sync.Mutex
}

func WithLevel(level LogLevel) option {
	return func(o *LogOptions) {
		o.Level = level
	}
}

func WithLevelInt(level int) option {
	return func(o *LogOptions) {
		o.Level = LogLevel(level)
	}
}

func WithTimeFormat(format string) option {
	return func(o *LogOptions) {
		o.TimeFormat = format
	}
}

func WithOutput(output io.Writer) option {
	return func(o *LogOptions) {
		o.Output = output
	}
}

func WithColors(useColors bool) option {
	return func(o *LogOptions) {
		o.UseColors = useColors
	}
}

func NewLogger(opts ...option) *Logger {
	options := LogOptions{
		Level:         Info,
		ShowTimeStamp: true,
		TimeFormat:    "2006-01-02 15:04:05",
		Output:        os.Stdout,
		UseColors:     true,
	}

	for _, opt := range opts {
		opt(&options)
	}

	return &Logger{
		options: options,
	}
}

func (l *Logger) log(level LogLevel, message string, ctx map[string]interface{}) {
	if level < l.options.Level {
		return
	}

	l.mu.Lock()
	defer l.mu.Unlock()

	timestamp := ""
	if l.options.ShowTimeStamp {
		timestamp = time.Now().Format(l.options.TimeFormat) + " "
	}

	color := ""
	reset := ""
	if l.options.UseColors {
		color = levelColors[level]
		reset = "\033[0m"
	}

	contextStr := ""
	if len(ctx) > 0 {
		contextStr = fmt.Sprintf(" %+v", ctx)
	}

	fmt.Fprintf(l.options.Output, "%s%s[%s]%s %s%s\n",
		color,
		timestamp,
		level.String(),
		contextStr,
		message,
		reset,
	)

	if level == Fatal {
		os.Exit(1)
	}
}

func (l LogLevel) String() string {
	switch l {
	case Debug:
		return "DEBUG"
	case Info:
		return "INFOR"
	case Warn:
		return "WARNI"
	case Error:
		return "ERROR"
	case Fatal:
		return "FATAL"
	default:
		return "UNKNOWN"
	}
}

// Convenience methods
func (l *Logger) Debug(message string, ctx ...map[string]interface{}) {
	context := make(map[string]interface{})
	if len(ctx) > 0 {
		context = ctx[0]
	}
	l.log(Debug, message, context)
}

func (l *Logger) Info(message string, ctx ...map[string]interface{}) {
	context := make(map[string]interface{})
	if len(ctx) > 0 {
		context = ctx[0]
	}
	l.log(Info, message, context)
}

func (l *Logger) Warn(message string, ctx ...map[string]interface{}) {
	context := make(map[string]interface{})
	if len(ctx) > 0 {
		context = ctx[0]
	}
	l.log(Warn, message, context)
}

func (l *Logger) Error(message string, ctx ...map[string]interface{}) {
	context := make(map[string]interface{})
	if len(ctx) > 0 {
		context = ctx[0]
	}
	l.log(Error, message, context)
}

func (l *Logger) Fatal(message string, ctx ...map[string]interface{}) {
	context := make(map[string]interface{})
	if len(ctx) > 0 {
		context = ctx[0]
	}
	l.log(Fatal, message, context)
}

// Formatted logging methods
func (l *Logger) Debugf(format string, args ...interface{}) {
	l.Debug(fmt.Sprintf(format, args...))
}

func (l *Logger) Infof(format string, args ...interface{}) {
	l.Info(fmt.Sprintf(format, args...))
}

func (l *Logger) Warnf(format string, args ...interface{}) {
	l.Warn(fmt.Sprintf(format, args...))
}

func (l *Logger) Errorf(format string, args ...interface{}) {
	l.Error(fmt.Sprintf(format, args...))
}

func (l *Logger) Fatalf(format string, args ...interface{}) {
	l.Fatal(fmt.Sprintf(format, args...))
}
