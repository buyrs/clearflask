package com.smotana.clearflask.billing;


import com.smotana.clearflask.api.model.AccountAdmin.SubscriptionStatusEnum;
import com.smotana.clearflask.api.model.Invoices;
import lombok.Value;
import org.killbill.billing.client.model.gen.Account;
import org.killbill.billing.client.model.gen.PaymentMethod;
import org.killbill.billing.client.model.gen.Subscription;

import java.util.Optional;

public interface Billing {

    AccountWithSubscription createAccountWithSubscription(String accountId, String email, String name, String planId);

    Account getAccount(String accountId);

    Subscription getSubscription(String accountId);

    SubscriptionStatusEnum getSubscriptionStatusFrom(Account account, Subscription subscription);

    void updatePaymentToken(String accountId, Gateway type, String paymentToken);

    Subscription cancelSubscription(String accountId);

    Subscription undoPendingCancel(String accountId);

    Subscription changePlan(String accountId, String planId);

    Subscription activateSubscription(String accountId, String planId);

    Invoices getInvoices(String accountId, Optional<String> cursorOpt);

    String getInvoiceHtml(String accountId, String invoiceId);

    Optional<PaymentMethodDetails> getDefaultPaymentMethodDetails(String accountId);

    @Value
    class AccountWithSubscription {
        Account account;
        Subscription subscription;
    }

    @Value
    class PaymentMethodDetails {
        Gateway gateway;
        PaymentMethod paymentMethod;
        Optional<String> cardBrand;
        Optional<String> cardLast4;
        Optional<Long> cardExpiryYear;
        Optional<Long> cardExpiryMonth;
    }

    enum Gateway {
        STRIPE("killbill-stripe", true),
        NOOP("__EXTERNAL_PAYMENT__", false),
        OTHER("", false);

        private final String pluginName;
        private final boolean allowedInProduction;

        Gateway(String pluginName, boolean allowedInProduction) {
            this.pluginName = pluginName;
            this.allowedInProduction = allowedInProduction;
        }

        public String getPluginName() {
            return pluginName;
        }

        public boolean isAllowedInProduction() {
            return allowedInProduction;
        }
    }
}
