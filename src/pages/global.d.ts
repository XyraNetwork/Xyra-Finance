// global.d.ts
declare module 'glslCanvas';

// Shield Wallet global declarations
interface ShieldWallet {
    publicKey?: string;
    isAvailable(): Promise<boolean>;
    signMessage(message: Uint8Array): Promise<{ signature: Uint8Array }>;
    decrypt(cipherText: string, tpk?: string, programId?: string, functionName?: string, index?: number): Promise<{ text: string }>;
    requestRecords(program: string): Promise<{ records: any[] }>;
    requestTransaction(transaction: any): Promise<{ transactionId?: string }>;
    requestExecution(transaction: any): Promise<{ transactionId?: string }>;
    requestBulkTransactions(transactions: any[]): Promise<{ transactionIds?: string[] }>;
    requestDeploy(deployment: any): Promise<{ transactionId?: string }>;
    transactionStatus(transactionId: string): Promise<{ status: string }>;
    transitionViewKeys(transactionId: string): Promise<{ viewKeys?: string[] }>;
    getExecution(transactionId: string): Promise<{ execution: string }>;
    requestRecordPlaintexts(program: string): Promise<{ records: any[] }>;
    requestTransactionHistory(program: string): Promise<{ transactions: any[] }>;
    connect(decryptPermission: any, network: any, programs?: string[]): Promise<void>;
    disconnect(): Promise<void>;
    on?(event: string, callback: (...args: any[]) => void): void;
    off?(event: string, callback: (...args: any[]) => void): void;
    emit?(event: string, ...args: any[]): void;
}

interface Window {
    shield?: ShieldWallet;
    shieldWallet?: ShieldWallet;
    shieldApp?: ShieldWallet;
}
