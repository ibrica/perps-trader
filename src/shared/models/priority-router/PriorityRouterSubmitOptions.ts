export interface PriorityRouterSubmitOptions {
  /**
   * Raw bytes of signed transaction.
   * */
  transaction: {
    content: string;
  };

  /**
   * Tip to be sent when using versioned transacitons
   * */
  tip: number;

  /**
   * Tip to be sent to jito
   * */
  jitoTip?: number;

  /**
   * OPTIONAL. Useful for disabling transaction simulation before actual submission. true or false, Default False
   * */
  skipPreFlight?: boolean;

  /**
   * OPTIONAL. Specify if you would like to enable the Front-Running Protection feature. The transaction must include an
   * Tip instruction to pay for the service fee. You can include an
   * Tip instruction but set this field to False. In this case, Trader API will propagate to both Jito and publicly. Default False.
   * */
  frontRunningProtection?: boolean;

  /**
   * OPTIONAL. This is an optional parameter that effects the behavior of frontRunningProtection which must be set to True to use this feature. Enabling this parameter will allow you to submit your transaction not only to the Jito but also to bloXroute-identified low-risk validators.
   * */
  fastBestEffort?: boolean;

  /**
   * OPTIONAL. tip instruction with a minimum of 0.001 SOL is required and frontRunningProtection must be set to False to use this feature. When enabled, Trader API will use weighted stake qOS  to submit your transaction to the Leader. The cost will be 10% of the
   * tip amount.
   * */
  useStakedRPCs?: boolean;
}
