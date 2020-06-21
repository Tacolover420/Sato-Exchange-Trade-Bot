const ini = require("ini");
const fs = require("fs");
const config = ini.parse(fs.readFileSync("./config.ini", "utf-8"));
const SatoClient = require("satoexchange-rpc-api-client").SatoClient;
const satoClient = new SatoClient(config.USERNAME, config.API_KEY);

startTrade();

function startTrade() {
    // GET TIMEOUT
    let timeout = randomize(config.TIME_RANGE, 0) * 1000;
    console.log("Timeout set to " + timeout + "seconds");
    setTimeout(() => {
        satoClient
            .get_markets({ action: "search", search_q: config.COIN_NAME })
            .then(function (response) {
                let markets = response.data.result.markets;
                let market = markets.find((m) => m.slug === config.MARKET_SLUG);
                let market_slug = market.slug;
                let market_id = market.id;
                if (market) {
                    satoClient
                        .get_market_orders({ market_id: market_id })
                        .then(function (response) {
                            let market_orders = response.data;
                            let min_sell_order = market_orders.result.sell_orders[0];
                            let max_buy_order = market_orders.result.buy_orders[0];
                            let ask = min_sell_order.price;
                            let bid = max_buy_order.price;

                            // GET PRICE DEVIATION
                            let rand_deviation = randomize(config.PRICE_DEVIATION, config.PRICE_DECIMAL_PLACE);
                            console.log("Price deviation is " + rand_deviation);

                            // SET PRICE
                            let price = ask - rand_deviation;

                            // CHECK PRICE AGAINST BID PRICE
                            if (price < bid) {
                                // GET AMOUNT DEVIATION
                                let rand_amount_deviation = randomize(
                                    config.AMOUNT_DEVIATION,
                                    config.AMOUNT_DECIMAL_PLACE
                                );
                                console.log("Amount deviation is " + rand_amount_deviation);

                                // SET AMOUNT
                                let amount = config.AMOUNT - rand_amount_deviation;

                                let order_param = {
                                    action: "sell",
                                    market: market_slug,
                                    price: price,
                                    amount: amount,
                                };

                                satoClient
                                    .order(order_param)
                                    .then(function (response) {
                                        console.log(response);
                                        let order_response = response.data;
                                        if (!order_response.error) {
                                            let new_order = order_response.result.new_order;
                                            satoClient
                                                .get_market_orders({
                                                    market_id: market_id,
                                                })
                                                .then(function (response) {
                                                    let sell_order = response.data.result.sell_orders[0];
                                                    if (sell_order.price == new_order.price) {
                                                        order_param.action = "buy";
                                                    } else {
                                                        order_param.action = "cancel_order";
                                                        order_param.order_id = new_order.id;
                                                    }
                                                    satoClient
                                                        .order(order_param)
                                                        .then(function (response) {
                                                            let trade_order = response.data;
                                                            console.log("Trade order is " + trade_order);
                                                            if (!trade_order.error) {
                                                            } else logError(trade_order.error.data);
                                                        })
                                                        .catch(function (error) {
                                                            logError(error);
                                                        });
                                                })
                                                .catch(function (error) {
                                                    logError(error);
                                                });
                                        } else {
                                            logError(order_response.error.data);
                                        }
                                    })
                                    .catch(function (error) {
                                        logError(error);
                                    });
                            }
                        })
                        .catch(function (error) {
                            logError(error);
                        });
                }
            })
            .catch(function (error) {
                logError(error);
            });
        startTrade();
    }, timeout);
}

function randomize(number, round) {
    let number_deviation = number.split("-");
    let min_deviation = number_deviation[0];
    let max_deviation = number_deviation[1];
    return getRandomFloat(min_deviation, max_deviation).toFixed(round);
}

function logError(error) {
    fs.writeFile("./error.txt", Date.now + " -> " + error, function (param) {});
}

function getRandomFloat(min, max) {
    return Math.random() * (parseFloat(max) - parseFloat(min)) + parseFloat(min);
}
