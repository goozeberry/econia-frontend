import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { CoinListClient, type NetworkType } from "@manahippo/coin-list";
import { AptosClient, type Types } from "aptos";
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
} from "react";
import { toast } from "react-toastify";

import { MAINNET_TOKEN_LIST, TESTNET_TOKEN_LIST } from "@/constants";
import {
  NETWORK_NAME,
  READ_ONLY_MESSAGE,
  READ_ONLY_MODE,
  RPC_NODE_URL,
} from "@/env";

type WalletContextState = ReturnType<typeof useWallet>;

export type AptosContextState = {
  aptosClient: AptosClient;
  signAndSubmitTransaction: WalletContextState["signAndSubmitTransaction"];
  account: WalletContextState["account"];
  coinListClient: CoinListClient;
};

export const AptosContext = createContext<AptosContextState | undefined>(
  undefined,
);

const isEntryFunctionPayload = (
  transaction: Types.TransactionPayload,
): transaction is Types.TransactionPayload_EntryFunctionPayload => {
  return transaction.type === "entry_function_payload";
};

export function AptosContextProvider({ children }: PropsWithChildren) {
  const { signAndSubmitTransaction: aptosSignAndSubmitTransaction, account } =
    useWallet();
  const aptosClient = useMemo(() => new AptosClient(RPC_NODE_URL), []);

  const signAndSubmitTransaction = useCallback(
    async (
      ...args: Parameters<WalletContextState["signAndSubmitTransaction"]>
    ) => {
      if (READ_ONLY_MODE === 1) {
        toast.error(READ_ONLY_MESSAGE);
        return;
      }
      let transaction = args[0];
      const options = args[1];
      if (isEntryFunctionPayload(transaction)) {
        transaction = {
          ...transaction,
          arguments: transaction.arguments.map((arg) => {
            if (typeof arg === "bigint") {
              return arg.toString();
            }
            return arg;
          }),
        };
      }

      try {
        const res = await aptosSignAndSubmitTransaction(transaction, options);
        try {
          await aptosClient.waitForTransaction(res?.hash || "");
          toast.success("Transaction confirmed");
          return true;
        } catch (error) {
          toast.error("Transaction failed");
          console.error(error);
          return false;
        }
        //eslint-disable-next-line
      } catch (error: any) {
        if (error && error?.includes("Account not found")) {
          toast.error("You need APT balance!");
        }
      }
    },
    [aptosSignAndSubmitTransaction, aptosClient],
  );
  const coinListClient = useMemo(() => {
    return new CoinListClient(
      true,
      (NETWORK_NAME as NetworkType) || "mainnet",
      NETWORK_NAME === "mainnet" ? MAINNET_TOKEN_LIST : TESTNET_TOKEN_LIST,
    );
  }, []);

  const value: AptosContextState = {
    aptosClient,
    account,
    signAndSubmitTransaction,
    coinListClient,
  };

  return (
    <AptosContext.Provider value={value}>{children}</AptosContext.Provider>
  );
}

export const useAptos = (): AptosContextState => {
  const context = useContext(AptosContext);
  if (context == null) {
    throw new Error(
      "useAccountContext must be used within a AccountContextProvider.",
    );
  }
  return context;
};
