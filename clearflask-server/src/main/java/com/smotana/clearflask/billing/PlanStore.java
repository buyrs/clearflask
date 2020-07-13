package com.smotana.clearflask.billing;

import com.google.common.collect.ImmutableSet;
import com.smotana.clearflask.api.model.Plan;
import com.smotana.clearflask.api.model.PlansGetResponse;

import java.util.Optional;

public interface PlanStore {

    PlansGetResponse plansGet();

    ImmutableSet<Plan> mapIdsToPlans(ImmutableSet<String> planIds);

    Optional<Plan> getPlan(String planId);

    Optional<String> getStripePriceId(String planId);

    ImmutableSet<Plan> availablePlansToChangeFrom(String planId);
}