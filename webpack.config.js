const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
    entry: "./src/index.ts",
    devtool: "inline-source-map",
    module: {
        rules: [
            {
                test: /\.ts?$/,
                use: "ts-loader",
                exclude: /node_modules/,
            },
            {
                test: /\.glsl$/,
                use: {
                    loader: "webpack-glsl-minify",
                    options: {
                        output: "source",
                        esModule: true,
                        preserveAll: true,
                    },
                },
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        extensions: [".ts", ".ts", ".js", ".glsl"],
    },
    output: {
        filename: "bundle.js",
        path: path.resolve(__dirname, "dist"),
    },
    devServer: {
        static: {
            directory: path.join(__dirname, "public"),
        },
        open: true,
        compress: true,
        port: 7474,
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: "/src/index.html",
        }),
    ],
};
